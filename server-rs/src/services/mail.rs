// Courriel de demande de documents aux fournisseurs (rapprochement BL / factures) :
// - contenu : shared/supplierMail.ts (objet, texte, HTML avec la signature et le
//   logo du magasin), reproduit caractère pour caractère ;
// - envoi : server/emailService.ts, par le serveur SMTP propre à chaque magasin
//   (mot de passe chiffré en base, déchiffré au moment de l'envoi), logo joint
//   en pièce intégrée « cid:logo » ;
// - journal : table supplier_mail_logs (storage.createSupplierMailLog).

use std::time::Duration;

use chrono::{Datelike, NaiveDate, NaiveDateTime};
use lettre::message::header::{ContentDisposition, ContentId, ContentType};
use lettre::message::{Body, Mailbox, Mailboxes, MultiPart, SinglePart, header};
use lettre::transport::smtp::authentication::Credentials;
use lettre::transport::smtp::client::{Tls, TlsParameters};
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};
use rand::RngCore;
use rust_decimal::Decimal;
use serde_json::{Map, Value, json};
use sqlx::PgPool;

use crate::schema::{GroupsRow, SupplierMailLogsRow};

/// Livraison telle que la lit le contenu du mail (SupplierMailDelivery)
#[derive(Debug, Clone, Default)]
pub struct MailDelivery {
    pub bl_number: Option<String>,
    pub bl_amount: Option<Decimal>,
    pub invoice_reference: Option<String>,
    pub scheduled_date: Option<NaiveDate>,
    pub delivered_date: Option<NaiveDateTime>,
    pub supplier_name: Option<String>,
    pub group_name: Option<String>,
}

/// Coordonnées du magasin reprises dans la signature (StoreSignature)
#[derive(Debug, Clone, Default)]
pub struct StoreSignature {
    pub name: Option<String>,
    pub address: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
}

impl StoreSignature {
    /// Signature d'un magasin : nom, adresse, téléphone, adresse d'expédition
    pub fn of_group(group: &GroupsRow) -> Self {
        Self {
            name: Some(group.name.clone()),
            address: group.address.clone(),
            phone: group.phone.clone(),
            email: group.smtp_sender_email.clone(),
        }
    }
}

/// Valeur « vraie » en JavaScript : présente et non vide
fn filled(value: &Option<String>) -> Option<&str> {
    value.as_deref().filter(|text| !text.is_empty())
}

/// formatDate : jj/mm/aaaa de la date de livraison, sinon de la date prévue
fn formatted_date(delivery: &MailDelivery) -> Option<String> {
    let date = match (delivery.delivered_date, delivery.scheduled_date) {
        (Some(delivered), _) => delivered.date(),
        (None, Some(scheduled)) => scheduled,
        (None, None) => return None,
    };
    Some(format!("{:02}/{:02}/{}", date.day(), date.month(), date.year()))
}

/// buildSupplierMailSubject : identifie la livraison concernée
pub fn subject(delivery: &MailDelivery) -> String {
    let date = formatted_date(delivery);
    let bl_number = filled(&delivery.bl_number);
    let reference = match (bl_number, &date) {
        (Some(bl), _) => format!("BL n° {bl}"),
        (None, Some(date)) => format!("Livraison du {date}"),
        (None, None) => "Livraison".to_string(),
    };
    let mut parts = vec!["Demande de facture (PDF) ou BL (Excel)".to_string()];
    parts.push(match (bl_number, &date) {
        (Some(_), Some(date)) => format!("{reference} du {date}"),
        _ => reference,
    });
    if let Some(name) = filled(&delivery.group_name) {
        parts.push(name.to_string());
    }
    parts.join(" - ")
}

/// buildDeliveryDetails : seules les informations renseignées sont listées
fn details(delivery: &MailDelivery) -> Vec<String> {
    let mut lines = Vec::new();
    if let Some(name) = filled(&delivery.supplier_name) {
        lines.push(format!("Fournisseur : {name}"));
    }
    if let Some(name) = filled(&delivery.group_name) {
        lines.push(format!("Magasin : {name}"));
    }
    if let Some(date) = formatted_date(delivery) {
        lines.push(format!("Date de livraison : {date}"));
    }
    if let Some(bl) = filled(&delivery.bl_number) {
        lines.push(format!("N° de BL : {bl}"));
    }
    if let Some(amount) = delivery.bl_amount {
        // parseFloat(montant).toFixed(2)
        lines.push(format!("Montant du BL : {} €", to_fixed_2(amount)));
    }
    if let Some(reference) = filled(&delivery.invoice_reference) {
        lines.push(format!("Référence facture : {reference}"));
    }
    if lines.is_empty() {
        lines.push("(informations de livraison à préciser)".to_string());
    }
    lines
}

/// parseFloat(montant).toFixed(2) d'un montant à deux décimales au plus
/// (« -0 » s'écrit « 0.00 »)
fn to_fixed_2(amount: Decimal) -> String {
    let amount = amount.round_dp(2);
    let amount = if amount.is_zero() { Decimal::ZERO } else { amount };
    format!("{amount:.2}")
}

/// buildSupplierMailText : version texte (repli des clients sans HTML)
pub fn text(delivery: &MailDelivery, store: Option<&StoreSignature>) -> String {
    let signature = store
        .map(|store| {
            [
                filled(&store.name).map(str::to_string),
                filled(&store.address).map(str::to_string),
                filled(&store.phone).map(|phone| format!("Tél. {phone}")),
                filled(&store.email).map(str::to_string),
            ]
            .into_iter()
            .flatten()
            .collect::<Vec<_>>()
            .join("\n")
        })
        .unwrap_or_default();
    let mut lines: Vec<String> = [
        "Bonjour,",
        "",
        "Dans le cadre du rapprochement de nos bons de livraison et de vos factures, nous vous remercions de bien vouloir nous transmettre :",
        "",
        "- la facture au format PDF, ou",
        "- le bon de livraison au format Excel",
        "",
        "Livraison concernée :",
    ]
    .iter()
    .map(|line| line.to_string())
    .collect();
    lines.extend(details(delivery).into_iter().map(|line| format!("- {line}")));
    lines.extend(
        ["", "Vous en remerciant par avance.", "", "Cordialement,"]
            .iter()
            .map(|line| line.to_string()),
    );
    if !signature.is_empty() {
        lines.push(signature);
    }
    lines.join("\n")
}

/// escapeHtml : & < > " (l'apostrophe reste telle quelle)
fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

/// buildSupplierMailHtml : version HTML, signature et logo (référencé par cid:logo)
pub fn html(delivery: &MailDelivery, store: Option<&StoreSignature>, has_logo: bool) -> String {
    let details: String = details(delivery)
        .iter()
        .map(|line| format!("<li>{}</li>", escape_html(line)))
        .collect();
    let signature_lines: Vec<String> = store
        .map(|store| {
            [
                filled(&store.name).map(|name| format!("<strong>{}</strong>", escape_html(name))),
                filled(&store.address).map(|address| escape_html(address).replace('\n', "<br>")),
                filled(&store.phone).map(|phone| format!("Tél. {}", escape_html(phone))),
                filled(&store.email).map(|email| {
                    let email = escape_html(email);
                    format!("<a href=\"mailto:{email}\">{email}</a>")
                }),
            ]
            .into_iter()
            .flatten()
            .collect()
        })
        .unwrap_or_default();
    let logo_block = if has_logo {
        "<p style=\"margin:0 0 8px 0;\"><img src=\"cid:logo\" alt=\"\" style=\"max-width:200px;height:auto;border:0;\"></p>"
    } else {
        ""
    };
    let signature_block = if !signature_lines.is_empty() || !logo_block.is_empty() {
        format!(
            "{logo_block}<p style=\"margin:0;color:#444;font-size:13px;line-height:1.5;\">{}</p>",
            signature_lines.join("<br>")
        )
    } else {
        String::new()
    };
    format!(
        "<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;line-height:1.5;\">
  <p>Bonjour,</p>
  <p>Dans le cadre du rapprochement de nos bons de livraison et de vos factures, nous vous remercions de bien vouloir nous transmettre&nbsp;:</p>
  <ul>
    <li>la facture au format PDF, ou</li>
    <li>le bon de livraison au format Excel</li>
  </ul>
  <p style=\"margin-bottom:4px;\">Livraison concernée&nbsp;:</p>
  <ul>{details}</ul>
  <p>Vous en remerciant par avance.</p>
  <p style=\"margin-bottom:12px;\">Cordialement,</p>
  {signature_block}
</div>"
    )
}

// ---------- Envoi ----------

/// getMissingSmtpFields : ce qu'il reste à renseigner sur la fiche du magasin
pub fn missing_smtp_fields(group: &GroupsRow) -> Vec<&'static str> {
    let blank = |value: &Option<String>| crate::js::trim(value.as_deref().unwrap_or_default()).is_empty();
    let mut missing = Vec::new();
    if blank(&group.smtp_host) {
        missing.push("serveur SMTP");
    }
    if group.smtp_port.is_none_or(|port| port == 0) {
        missing.push("port SMTP");
    }
    if blank(&group.smtp_sender_email) {
        missing.push("adresse expéditeur");
    }
    missing
}

/// Logo du magasin en data URI (parseLogoDataUri) : contenu, type, nom de fichier
struct Logo {
    content: Vec<u8>,
    content_type: String,
    filename: String,
}

/// /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/ sur le logo sans blancs autour
fn parse_logo(logo: Option<&str>) -> Option<Logo> {
    let logo = crate::js::trim(logo.filter(|logo| !logo.is_empty())?);
    let rest = logo.strip_prefix("data:image/")?;
    let (subtype, data) = rest.split_once(";base64,")?;
    let subtype_ok = !subtype.is_empty()
        && subtype
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || ".+-".contains(c));
    // « . » de JavaScript : tout sauf les fins de ligne
    let data_ok = !data.is_empty() && !data.contains(['\n', '\r', '\u{2028}', '\u{2029}']);
    if !subtype_ok || !data_ok {
        return None;
    }
    let extension = subtype
        .split('+')
        .next()
        .filter(|ext| !ext.is_empty())
        .unwrap_or("png");
    Some(Logo {
        content: crate::js::buffer_from_base64(data),
        content_type: format!("image/{subtype}"),
        filename: format!("logo.{extension}"),
    })
}

/// Erreur d'envoi : le message que nodemailer donnerait pour les cas courants
/// (serveur injoignable, nom inconnu), sinon celui de lettre
fn smtp_error_message(error: &lettre::transport::smtp::Error, host: &str, port: u16) -> String {
    let mut source: Option<&(dyn std::error::Error + 'static)> = Some(error);
    while let Some(current) = source {
        if let Some(io) = current.downcast_ref::<std::io::Error>() {
            if io.kind() == std::io::ErrorKind::ConnectionRefused {
                return format!("connect ECONNREFUSED {host}:{port}");
            }
            if io.to_string().contains("failed to lookup address") {
                return format!("getaddrinfo ENOTFOUND {host}");
            }
        }
        source = current.source();
    }
    error.to_string()
}

/// Transporteur SMTP du magasin (createTransporter) : authentification seulement
/// si un utilisateur et un mot de passe sont renseignés
fn transport(
    group: &GroupsRow,
    encryption_key: &str,
) -> Result<(AsyncSmtpTransport<Tokio1Executor>, String, u16), String> {
    let missing = missing_smtp_fields(group);
    if !missing.is_empty() {
        return Err(format!("Configuration SMTP incomplète : {}", missing.join(", ")));
    }
    let password = match group.smtp_password.as_deref() {
        Some(value) if !value.is_empty() => Some(crate::crypto::decrypt(value, encryption_key)?),
        _ => None,
    };
    let host = crate::js::trim(group.smtp_host.as_deref().unwrap_or_default()).to_string();
    let port = u16::try_from(group.smtp_port.unwrap_or_default())
        .map_err(|_| format!("Port SMTP invalide : {:?}", group.smtp_port))?;
    // secure : TLS dès la connexion ; sinon STARTTLS si le serveur le propose (un
    // nom d'hôte inutilisable en TLS laisse alors la connexion échouer d'elle-même)
    let tls = match (group.smtp_secure == Some(true), TlsParameters::new(host.clone())) {
        (true, parameters) => Tls::Wrapper(parameters.map_err(|error| error.to_string())?),
        (false, Ok(parameters)) => Tls::Opportunistic(parameters),
        (false, Err(_)) => Tls::None,
    };
    let mut builder = AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(host.clone())
        .port(port)
        .tls(tls)
        .timeout(Some(Duration::from_secs(60)));
    let user = group
        .smtp_user
        .as_deref()
        .map(crate::js::trim)
        .unwrap_or_default();
    if let Some(password) = password.filter(|password| !password.is_empty() && !user.is_empty()) {
        builder = builder.credentials(Credentials::new(user.to_string(), password));
    }
    Ok((builder.build(), host, port))
}

/// verifySmtpConfig : connexion, présentation et authentification, sans envoi
pub async fn verify_smtp_config(group: &GroupsRow, encryption_key: &str) -> Result<(), String> {
    let (transport, host, port) = transport(group, encryption_key)?;
    transport
        .test_connection()
        .await
        .map(|_| ())
        .map_err(|error| smtp_error_message(&error, &host, port))
}

/// Identifiant du message, au format de nodemailer : <xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx@domaine>
fn message_id(sender_email: &str) -> String {
    let mut bytes = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut bytes);
    let hex: String = bytes.iter().map(|b| format!("{b:02x}")).collect();
    let domain = sender_email.rsplit('@').next().unwrap_or("localhost");
    format!(
        "<{}-{}-{}-{}-{}@{domain}>",
        &hex[0..8],
        &hex[8..12],
        &hex[12..16],
        &hex[16..20],
        &hex[20..32]
    )
}

/// sendSupplierDocumentRequest : envoie la demande de facture PDF / BL Excel et
/// rend l'identifiant du message, ou le message d'erreur à journaliser
pub async fn send_supplier_document_request(
    group: &GroupsRow,
    delivery: &MailDelivery,
    supplier_email: &str,
    encryption_key: &str,
) -> Result<String, String> {
    let (transport, host, port) = transport(group, encryption_key)?;
    let sender_email = crate::js::trim(group.smtp_sender_email.as_deref().unwrap_or_default()).to_string();
    let sender_name = group
        .smtp_sender_name
        .as_deref()
        .map(crate::js::trim)
        .filter(|name| !name.is_empty())
        .or_else(|| Some(crate::js::trim(&group.name)).filter(|name| !name.is_empty()));
    let invalid = |error: lettre::address::AddressError| error.to_string();
    let from = Mailbox::new(
        sender_name.map(str::to_string),
        sender_email.parse().map_err(invalid)?,
    );
    let reply_to = Mailbox::new(None, sender_email.parse().map_err(invalid)?);
    let to: Mailboxes = crate::js::trim(supplier_email).parse().map_err(invalid)?;

    let store = StoreSignature::of_group(group);
    let logo = parse_logo(group.logo.as_deref());
    let html_part = SinglePart::html(html(delivery, Some(&store), logo.is_some()));
    let text_part = SinglePart::plain(text(delivery, Some(&store)));
    let alternative = match logo {
        Some(logo) => {
            let content_type = ContentType::parse(&format!("{}; name={}", logo.content_type, logo.filename))
                .map_err(|error| error.to_string())?;
            let image = SinglePart::builder()
                .header(content_type)
                .header(ContentId::from("<logo>".to_string()))
                .header(ContentDisposition::inline_with_name(&logo.filename))
                .body(Body::new(logo.content));
            MultiPart::alternative()
                .singlepart(text_part)
                .multipart(MultiPart::related().singlepart(html_part).singlepart(image))
        }
        None => MultiPart::alternative()
            .singlepart(text_part)
            .singlepart(html_part),
    };
    let id = message_id(&sender_email);
    let message = Message::builder()
        .from(from)
        .mailbox(header::To::from(to))
        .reply_to(reply_to)
        .subject(subject(delivery))
        .message_id(Some(id.clone()))
        .multipart(alternative)
        .map_err(|error| error.to_string())?;
    transport
        .send(message)
        .await
        .map_err(|error| smtp_error_message(&error, &host, port))?;
    Ok(id)
}

/// Ligne du journal des relances (insertSupplierMailLogSchema)
#[derive(Debug, Clone)]
pub struct MailLog {
    pub delivery_id: i32,
    pub group_id: i32,
    pub supplier_id: Option<i32>,
    pub supplier_name: Option<String>,
    pub sent_to: String,
    pub subject: String,
    /// « sent » ou « failed »
    pub status: &'static str,
    pub error_message: Option<String>,
    pub message_id: Option<String>,
    pub sent_by: String,
    pub sent_by_name: String,
}

/// storage.createSupplierMailLog
pub async fn record_mail_log(db: &PgPool, log: &MailLog) -> Result<SupplierMailLogsRow, sqlx::Error> {
    let mut data = Map::new();
    data.insert("deliveryId".into(), json!(log.delivery_id));
    data.insert("groupId".into(), json!(log.group_id));
    data.insert("supplierId".into(), json!(log.supplier_id));
    data.insert("supplierName".into(), json!(log.supplier_name));
    data.insert("sentTo".into(), json!(log.sent_to));
    data.insert("subject".into(), json!(log.subject));
    data.insert("status".into(), json!(log.status));
    data.insert("errorMessage".into(), json!(log.error_message));
    data.insert("messageId".into(), json!(log.message_id));
    data.insert("sentBy".into(), json!(log.sent_by));
    data.insert("sentByName".into(), Value::String(log.sent_by_name.clone()));
    crate::db::insert::<SupplierMailLogsRow>(db, &data).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    fn delivery() -> MailDelivery {
        MailDelivery {
            bl_number: Some("BL-1002".into()),
            bl_amount: Some(Decimal::from_str("310.00").unwrap()),
            invoice_reference: None,
            scheduled_date: NaiveDate::from_ymd_opt(2026, 10, 10),
            delivered_date: NaiveDate::from_ymd_opt(2026, 10, 10).and_then(|d| d.and_hms_opt(14, 0, 0)),
            supplier_name: Some("Bonduelle".into()),
            group_name: Some("Magasin Nancy".into()),
        }
    }

    fn store() -> StoreSignature {
        StoreSignature {
            name: Some("Magasin Nancy".into()),
            address: Some("12 rue des Dominicains, 54000 Nancy".into()),
            phone: Some("03 83 00 00 01".into()),
            email: Some("nancy@banc.test".into()),
        }
    }

    // Valeurs produites par shared/supplierMail.ts (Node 22, TZ=UTC)
    #[test]
    fn objet_comme_node() {
        assert_eq!(
            subject(&delivery()),
            "Demande de facture (PDF) ou BL (Excel) - BL n° BL-1002 du 10/10/2026 - Magasin Nancy"
        );
        let scheduled_only = MailDelivery {
            scheduled_date: NaiveDate::from_ymd_opt(2026, 10, 10),
            ..Default::default()
        };
        assert_eq!(
            subject(&scheduled_only),
            "Demande de facture (PDF) ou BL (Excel) - Livraison du 10/10/2026"
        );
        assert_eq!(
            subject(&MailDelivery::default()),
            "Demande de facture (PDF) ou BL (Excel) - Livraison"
        );
    }

    #[test]
    fn texte_comme_node() {
        assert_eq!(
            text(&delivery(), Some(&store())),
            "Bonjour,\n\nDans le cadre du rapprochement de nos bons de livraison et de vos factures, nous vous remercions de bien vouloir nous transmettre :\n\n- la facture au format PDF, ou\n- le bon de livraison au format Excel\n\nLivraison concernée :\n- Fournisseur : Bonduelle\n- Magasin : Magasin Nancy\n- Date de livraison : 10/10/2026\n- N° de BL : BL-1002\n- Montant du BL : 310.00 €\n\nVous en remerciant par avance.\n\nCordialement,\nMagasin Nancy\n12 rue des Dominicains, 54000 Nancy\nTél. 03 83 00 00 01\nnancy@banc.test"
        );
        assert_eq!(
            text(&MailDelivery::default(), None),
            "Bonjour,\n\nDans le cadre du rapprochement de nos bons de livraison et de vos factures, nous vous remercions de bien vouloir nous transmettre :\n\n- la facture au format PDF, ou\n- le bon de livraison au format Excel\n\nLivraison concernée :\n- (informations de livraison à préciser)\n\nVous en remerciant par avance.\n\nCordialement,"
        );
    }

    #[test]
    fn html_comme_node() {
        let html = html(&delivery(), Some(&store()), true);
        assert!(html.contains("<ul><li>Fournisseur : Bonduelle</li><li>Magasin : Magasin Nancy</li><li>Date de livraison : 10/10/2026</li><li>N° de BL : BL-1002</li><li>Montant du BL : 310.00 €</li></ul>"));
        assert!(html.contains("<p style=\"margin:0 0 8px 0;\"><img src=\"cid:logo\" alt=\"\" style=\"max-width:200px;height:auto;border:0;\"></p><p style=\"margin:0;color:#444;font-size:13px;line-height:1.5;\"><strong>Magasin Nancy</strong><br>12 rue des Dominicains, 54000 Nancy<br>Tél. 03 83 00 00 01<br><a href=\"mailto:nancy@banc.test\">nancy@banc.test</a></p>\n</div>"));
        let escaped = MailDelivery {
            supplier_name: Some("A & B <x>".into()),
            ..Default::default()
        };
        let signature = StoreSignature {
            name: Some("S\"1".into()),
            address: Some("l1\nl2".into()),
            ..Default::default()
        };
        assert_eq!(
            super::html(&escaped, Some(&signature), false),
            "<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;line-height:1.5;\">\n  <p>Bonjour,</p>\n  <p>Dans le cadre du rapprochement de nos bons de livraison et de vos factures, nous vous remercions de bien vouloir nous transmettre&nbsp;:</p>\n  <ul>\n    <li>la facture au format PDF, ou</li>\n    <li>le bon de livraison au format Excel</li>\n  </ul>\n  <p style=\"margin-bottom:4px;\">Livraison concernée&nbsp;:</p>\n  <ul><li>Fournisseur : A &amp; B &lt;x&gt;</li></ul>\n  <p>Vous en remerciant par avance.</p>\n  <p style=\"margin-bottom:12px;\">Cordialement,</p>\n  <p style=\"margin:0;color:#444;font-size:13px;line-height:1.5;\"><strong>S&quot;1</strong><br>l1<br>l2</p>\n</div>"
        );
    }

    #[test]
    fn logo_en_data_uri() {
        let logo = parse_logo(Some(" data:image/svg+xml;base64,PHN2Zz4= ")).unwrap();
        assert_eq!(logo.content_type, "image/svg+xml");
        assert_eq!(logo.filename, "logo.svg");
        assert_eq!(logo.content, b"<svg>");
        assert!(parse_logo(Some("data:text/plain;base64,QQ==")).is_none());
        assert!(parse_logo(Some("data:image/png;base64,QQ\n==")).is_none());
        assert!(parse_logo(None).is_none());
    }
}
