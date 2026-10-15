// Secrets chiffrés au repos (mot de passe SMTP des magasins, jeton NocoDB),
// compatibles avec server/crypto.ts : AES-256-GCM, clé = SHA-256 de
// ENCRYPTION_KEY (à défaut SESSION_SECRET), format enc:v1:<iv>:<tag>:<données>
// en base64. Une valeur en clair (héritée) est rendue telle quelle.

use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use rand::RngCore;
use sha2::{Digest, Sha256};

const PREFIX: &str = "enc:v1:";

fn cipher(secret: &str) -> Aes256Gcm {
    let key = Sha256::digest(secret.as_bytes());
    Aes256Gcm::new_from_slice(&key).expect("clé de 32 octets")
}

pub fn is_encrypted(value: &str) -> bool {
    value.starts_with(PREFIX)
}

/// encryptSecret : valeur vide ou déjà chiffrée rendue telle quelle
pub fn encrypt(value: &str, secret: &str) -> String {
    if value.is_empty() || is_encrypted(value) {
        return value.to_string();
    }
    let mut iv = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut iv);
    let sealed = cipher(secret)
        .encrypt(Nonce::from_slice(&iv), value.as_bytes())
        .expect("chiffrement AES-GCM");
    // aes-gcm place l'étiquette (16 octets) à la fin ; Node la stocke à part
    let (data, tag) = sealed.split_at(sealed.len() - 16);
    format!(
        "{PREFIX}{}:{}:{}",
        STANDARD.encode(iv),
        STANDARD.encode(tag),
        STANDARD.encode(data)
    )
}

/// decryptSecret : Err avec le message de Node si la valeur est illisible
pub fn decrypt(value: &str, secret: &str) -> Result<String, &'static str> {
    if !is_encrypted(value) {
        return Ok(value.to_string());
    }
    let parts: Vec<&str> = value[PREFIX.len()..].split(':').collect();
    let [iv, tag, data] = parts.as_slice() else {
        return Err("Secret chiffré illisible : format inattendu");
    };
    const UNREADABLE: &str =
        "Secret chiffré illisible : clé de chiffrement changée ou donnée altérée. Ressaisissez la valeur.";
    let decode = |part: &str| STANDARD.decode(part).map_err(|_| UNREADABLE);
    let (iv, tag, mut data) = (decode(iv)?, decode(tag)?, decode(data)?);
    if iv.len() != 12 {
        return Err(UNREADABLE);
    }
    data.extend_from_slice(&tag);
    let plain = cipher(secret)
        .decrypt(Nonce::from_slice(&iv), data.as_ref())
        .map_err(|_| UNREADABLE)?;
    String::from_utf8(plain).map_err(|_| UNREADABLE)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Chiffré par server/crypto.ts avec ENCRYPTION_KEY=banc-cle-de-chiffrement
    const FROM_NODE: &str = "enc:v1:n8TrNmt+VyaEal3x:gYKLZrnmBiGakpe8TI0Klg==:mnA5kYLSoJAdXxU3j1lb3g==";

    #[test]
    fn dechiffre_une_valeur_chiffree_par_node() {
        assert_eq!(
            decrypt(FROM_NODE, "banc-cle-de-chiffrement").unwrap(),
            "smtp-secret-banc"
        );
        assert!(decrypt(FROM_NODE, "autre-cle").is_err());
    }

    #[test]
    fn aller_retour_et_valeurs_en_clair() {
        let sealed = encrypt("jeton", "cle");
        assert!(is_encrypted(&sealed));
        assert_eq!(decrypt(&sealed, "cle").unwrap(), "jeton");
        assert_eq!(encrypt(&sealed, "cle"), sealed);
        assert_eq!(decrypt("en clair", "cle").unwrap(), "en clair");
        assert_eq!(encrypt("", "cle"), "");
    }
}
