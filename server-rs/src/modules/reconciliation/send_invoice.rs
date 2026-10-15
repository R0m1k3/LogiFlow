// POST /api/reconciliation/send-invoice (server/routes.ts) : le fichier d'une
// facture, reçu en multipart, est renvoyé en multipart (file, supplier, blNumber,
// type) au webhook dont l'adresse accompagne le formulaire (admin et directeur).
//
// Écart voulu (audit RAPPRO-21, déclaré au banc) : Node appelle toute adresse
// fournie par le navigateur. Ici, l'adresse doit être celle d'un magasin
// (groups.webhook_url, ce que l'interface envoie) ou du webhook BAP actif ; toute
// autre adresse est refusée (400) avant l'appel.
//
// Repris de Node : l'analyse multipart écrite à la main (parseMultipart), la
// lecture du corps sans limite de taille, l'encodage multipart de node-fetch
// (formdata-polyfill) et ses messages d'erreur, sans délai maximal.

use std::collections::HashMap;

use axum::Json;
use axum::body::Body;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode, header};
use axum::response::IntoResponse;
use rand::Rng;
use serde_json::json;

use crate::AppState;
use crate::auth::CurrentUser;
use crate::error::{ApiResult, AppError};
use crate::modules::bap::node_fetch_post;
use crate::services::nocodb::database_message;

fn error_body(status: StatusCode, error: &str) -> AppError {
    AppError::with_body(status, json!({ "error": error }))
}

// ---------- Analyse multipart (parseMultipart de Node) ----------

#[derive(Debug, Clone, PartialEq)]
enum Part {
    Text(String),
    File {
        filename: String,
        content_type: String,
        data: Vec<u8>,
    },
}

impl Part {
    /// Valeur « vraie » : un fichier (objet) toujours, un texte s'il n'est pas vide
    fn truthy(&self) -> bool {
        match self {
            Part::Text(text) => !text.is_empty(),
            Part::File { .. } => true,
        }
    }

    /// `parts.x || défaut` passé à FormData.append : un fichier devient « [object Object] »
    fn text_or(part: Option<&Part>, default: &str) -> String {
        match part {
            Some(Part::File { .. }) => "[object Object]".to_string(),
            Some(Part::Text(text)) if !text.is_empty() => text.clone(),
            _ => default.to_string(),
        }
    }
}

/// Première capture de /prefix([^stop]+)suffix/ : au moins un caractère, suivi de
/// `suffix` s'il est donné (recherche de gauche à droite, comme une expression régulière)
fn capture(text: &str, prefix: &str, stop: &[char], suffix: Option<char>) -> Option<String> {
    let mut from = 0;
    while let Some(found) = text[from..].find(prefix) {
        let start = from + found + prefix.len();
        let rest = &text[start..];
        let end = rest.find(|c: char| stop.contains(&c)).unwrap_or(rest.len());
        let complete = match suffix {
            Some(suffix) => rest[end..].starts_with(suffix),
            None => true,
        };
        if end > 0 && complete {
            return Some(rest[..end].to_string());
        }
        from = from + found + 1;
        while !text.is_char_boundary(from) {
            from += 1;
        }
    }
    None
}

/// /boundary="?([^";]+)"?/i sur l'en-tête Content-Type
fn boundary(content_type: &str) -> Option<String> {
    let lower = content_type.to_ascii_lowercase();
    let mut from = 0;
    while let Some(found) = lower[from..].find("boundary=") {
        let start = from + found + "boundary=".len();
        let rest = &content_type[start..];
        let is_value = |c: char| c != '"' && c != ';';
        // « "? » gourmand d'abord, puis sans le guillemet
        for skip in [rest.starts_with('"') as usize, 0] {
            let value: String = rest[skip..].chars().take_while(|c| is_value(*c)).collect();
            if !value.is_empty() {
                return Some(value);
            }
        }
        from = start;
    }
    None
}

fn find(haystack: &[u8], needle: &[u8], from: usize) -> Option<usize> {
    if needle.is_empty() || from > haystack.len() {
        return None;
    }
    haystack[from..]
        .windows(needle.len())
        .position(|window| window == needle)
        .map(|position| position + from)
}

/// Sections entre les délimiteurs, en-têtes jusqu'à la première ligne vide,
/// contenu sans ses deux derniers octets ; un nom répété garde la dernière partie
fn parse_multipart(buffer: &[u8], boundary: &str) -> HashMap<String, Part> {
    let delimiter = format!("--{boundary}").into_bytes();
    let mut sections = Vec::new();
    let mut start = 0;
    while let Some(index) = find(buffer, &delimiter, start) {
        if start > 0 {
            sections.push(&buffer[start..index]);
        }
        start = index + delimiter.len();
    }

    let mut parts = HashMap::new();
    for section in sections {
        let Some(header_end) = find(section, b"\r\n\r\n", 0) else {
            continue;
        };
        let headers = String::from_utf8_lossy(&section[..header_end]);
        let content_start = header_end + 4;
        let content_end = section.len().saturating_sub(2).max(content_start);
        let content = section.get(content_start..content_end).unwrap_or_default();

        let Some(name) = capture(&headers, "name=\"", &['"'], Some('"')) else {
            continue;
        };
        let part = match capture(&headers, "filename=\"", &['"'], Some('"')) {
            Some(filename) => Part::File {
                filename,
                content_type: capture(&headers, "Content-Type: ", &['\r', '\n'], None)
                    .unwrap_or_else(|| "application/octet-stream".to_string()),
                data: content.to_vec(),
            },
            None => Part::Text(String::from_utf8_lossy(content).into_owned()),
        };
        parts.insert(name, part);
    }
    parts
}

// ---------- Renvoi en multipart (formDataToBlob de node-fetch) ----------

/// Type d'un Blob : vide s'il sort de U+0020–U+007E, sinon en minuscules
fn blob_type(content_type: &str) -> String {
    if content_type.chars().all(|c| (' '..='~').contains(&c)) {
        content_type.to_ascii_lowercase()
    } else {
        String::new()
    }
}

/// Fin de ligne isolée (\r ou \n) remplacée par \r\n
fn crlf(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut chars = text.chars().peekable();
    while let Some(c) = chars.next() {
        match c {
            '\r' => {
                out.push_str("\r\n");
                if chars.peek() == Some(&'\n') {
                    chars.next();
                }
            }
            '\n' => out.push_str("\r\n"),
            other => out.push(other),
        }
    }
    out
}

/// Échappement des noms de champ et de fichier dans Content-Disposition
fn escape_name(name: &str, keep_newlines: bool) -> String {
    let name = if keep_newlines {
        name.to_string()
    } else {
        crlf(name)
    };
    name.replace('\n', "%0A").replace('\r', "%0D").replace('"', "%22")
}

/// Corps multipart et son type (boundary aléatoire, 32 caractères)
fn encode_form(file: (&str, &str, &[u8]), fields: &[(&str, String)]) -> (Vec<u8>, String) {
    let digits: String = (0..28)
        .map(|_| char::from(b'0' + rand::thread_rng().gen_range(0..10)))
        .collect();
    let boundary = format!("----{digits}");
    let (filename, content_type, data) = file;
    let mut body = Vec::with_capacity(data.len() + 512);
    let content_type = if content_type.is_empty() {
        "application/octet-stream"
    } else {
        content_type
    };
    body.extend_from_slice(
        format!(
            "--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{}\"\r\nContent-Type: {content_type}\r\n\r\n",
            escape_name(filename, true)
        )
        .as_bytes(),
    );
    body.extend_from_slice(data);
    body.extend_from_slice(b"\r\n");
    for (name, value) in fields {
        body.extend_from_slice(
            format!(
                "--{boundary}\r\nContent-Disposition: form-data; name=\"{}\"\r\n\r\n{}\r\n",
                escape_name(name, false),
                crlf(value)
            )
            .as_bytes(),
        );
    }
    body.extend_from_slice(format!("--{boundary}--").as_bytes());
    (body, format!("multipart/form-data; boundary={boundary}"))
}

// ---------- Adresse autorisée (RAPPRO-21) ----------

/// L'adresse est-elle celle d'un magasin ou du webhook BAP actif (première ligne
/// de la configuration, comme storage.getWebhookBapConfig) ?
async fn is_configured_webhook(db: &sqlx::PgPool, url: &str) -> Result<bool, sqlx::Error> {
    let (allowed,): (bool,) = sqlx::query_as(
        "SELECT EXISTS (SELECT 1 FROM groups WHERE webhook_url = $1)
             OR EXISTS (SELECT 1 FROM (SELECT webhook_url, is_active FROM webhook_bap_config LIMIT 1) bap
                         WHERE bap.is_active AND bap.webhook_url = $1)",
    )
    .bind(url)
    .fetch_one(db)
    .await?;
    Ok(allowed)
}

pub async fn send_invoice(
    State(state): State<AppState>,
    user: CurrentUser,
    headers: HeaderMap,
    body: Body,
) -> ApiResult {
    let server_error = |message: &str| {
        let message = if message.is_empty() {
            "Erreur serveur"
        } else {
            message
        };
        error_body(StatusCode::INTERNAL_SERVER_ERROR, message)
    };
    if !["admin", "directeur"].contains(&user.role()) {
        return Err(error_body(StatusCode::FORBIDDEN, "Accès refusé"));
    }
    let content_type = headers
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default();
    let Some(boundary) = boundary(content_type) else {
        return Err(error_body(StatusCode::BAD_REQUEST, "Format multipart invalide"));
    };
    // Corps lu en entier, sans limite de taille, comme Node
    let buffer = axum::body::to_bytes(body, usize::MAX)
        .await
        .map_err(|error| server_error(&error.to_string()))?;
    let parts = parse_multipart(&buffer, &boundary);

    let (Some(file), Some(webhook_url)) = (
        parts.get("file").filter(|part| part.truthy()),
        parts.get("webhookUrl").filter(|part| part.truthy()),
    ) else {
        return Err(error_body(StatusCode::BAD_REQUEST, "Fichier ou webhook manquant"));
    };
    // Champ « file » en texte : parts.file.buffer.length lève une TypeError
    let Part::File {
        filename,
        content_type: file_type,
        data,
    } = file
    else {
        return Err(server_error(
            "Cannot read properties of undefined (reading 'length')",
        ));
    };
    tracing::info!(
        user = user.id(),
        filename,
        size = data.len(),
        "envoi de facture au webhook"
    );

    // Écart voulu (RAPPRO-21) : seule une adresse configurée est appelée
    let allowed_url = match webhook_url {
        Part::Text(url) => is_configured_webhook(&state.db, url)
            .await
            .map_err(|error| server_error(&database_message(&error)))?
            .then_some(url),
        Part::File { .. } => None,
    };
    let Some(url) = allowed_url else {
        return Err(error_body(
            StatusCode::BAD_REQUEST,
            "Adresse de webhook non autorisée : seule l'adresse configurée pour un magasin ou pour le webhook BAP est acceptée",
        ));
    };

    let fields = [
        ("supplier", Part::text_or(parts.get("supplier"), "")),
        ("blNumber", Part::text_or(parts.get("blNumber"), "")),
        ("type", Part::text_or(parts.get("type"), "Facture")),
    ];
    let (form, form_type) = encode_form((filename, &blob_type(file_type), data), &fields);
    let response = node_fetch_post(
        url,
        |request| request.header(header::CONTENT_TYPE, form_type).body(form),
        None,
    )
    .await;
    match response {
        Ok((status, _)) if status.is_success() => {
            Ok(Json(json!({ "success": true, "message": "Facture envoyée" })).into_response())
        }
        Ok((status, details)) => {
            tracing::error!(%status, "webhook de facture en erreur");
            Err(AppError::with_body(
                StatusCode::INTERNAL_SERVER_ERROR,
                json!({ "error": format!("Webhook error: {}", status.as_u16()), "details": details }),
            ))
        }
        Err(error) => Err(server_error(&error.message)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn boundary_comme_l_expression_de_node() {
        assert_eq!(
            boundary("multipart/form-data; boundary=abc").as_deref(),
            Some("abc")
        );
        assert_eq!(
            boundary("multipart/form-data; BOUNDARY=\"a b\"; x=1").as_deref(),
            Some("a b")
        );
        assert_eq!(
            boundary("multipart/form-data; boundary=;boundary=z").as_deref(),
            Some("z")
        );
        assert_eq!(boundary("application/json"), None);
        assert_eq!(boundary(""), None);
    }

    #[test]
    fn analyse_multipart_comme_node() {
        let body = b"preambule\r\n--XX\r\nContent-Disposition: form-data; name=\"supplier\"\r\n\r\nLactalis\r\n\
--XX\r\nContent-Disposition: form-data; name=\"file\"; filename=\"f.pdf\"\r\nContent-Type: application/pdf\r\n\r\n%%%\r\n\
--XX\r\nContent-Disposition: form-data; name=\"vide\"; filename=\"\"\r\n\r\nabc\r\n\
--XX\r\nContent-Disposition: form-data; name=\"supplier\"\r\n\r\nBonduelle\r\n--XX--\r\n";
        let parts = parse_multipart(body, "XX");
        assert_eq!(parts.get("supplier"), Some(&Part::Text("Bonduelle".into())));
        assert_eq!(
            parts.get("file"),
            Some(&Part::File {
                filename: "f.pdf".into(),
                content_type: "application/pdf".into(),
                data: b"%%%".to_vec()
            })
        );
        // filename vide : /filename="([^"]+)"/ échoue, la partie est un texte
        assert_eq!(parts.get("vide"), Some(&Part::Text("abc".into())));
    }

    #[test]
    fn encodage_comme_form_data_to_blob() {
        assert_eq!(blob_type("Application/PDF"), "application/pdf");
        assert_eq!(blob_type("image/é"), "");
        assert_eq!(crlf("a\nb\rc\r\nd"), "a\r\nb\r\nc\r\nd");
        assert_eq!(escape_name("a\"b\nc", true), "a%22b%0Ac");
        let (body, content_type) = encode_form(("f.pdf", "", b"xy"), &[("type", "Facture".into())]);
        let boundary = content_type
            .strip_prefix("multipart/form-data; boundary=")
            .unwrap();
        assert_eq!(boundary.len(), 32);
        assert_eq!(
            String::from_utf8(body).unwrap(),
            format!(
                "--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"f.pdf\"\r\nContent-Type: application/octet-stream\r\n\r\nxy\r\n\
--{boundary}\r\nContent-Disposition: form-data; name=\"type\"\r\n\r\nFacture\r\n--{boundary}--"
            )
        );
    }
}
