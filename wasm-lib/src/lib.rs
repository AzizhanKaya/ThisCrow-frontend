use aes_gcm::{
    Aes256Gcm, Nonce,
    aead::{Aead, KeyInit},
};
use anyhow::Context;
use anyhow::anyhow;
use getrandom::getrandom;
use hkdf::Hkdf;
use sha2::{Digest, Sha256};
use wasm_bindgen::prelude::*;
use x25519_dalek::{PublicKey, StaticSecret};

mod error;
use error::Result;

#[wasm_bindgen]
pub struct KeyPair {
    private_key: Vec<u8>,
    public_key: Vec<u8>,
}

#[wasm_bindgen]
impl KeyPair {
    #[wasm_bindgen(getter)]
    pub fn private_key(&self) -> Vec<u8> {
        self.private_key.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn public_key(&self) -> Vec<u8> {
        self.public_key.clone()
    }
}

#[wasm_bindgen]
pub fn generate_keypair(hash: &str) -> KeyPair {
    let mut hasher = Sha256::new();
    hasher.update(hash.as_bytes());
    let secret_bytes: [u8; 32] = hasher.finalize().into();

    let private_key = StaticSecret::from(secret_bytes);
    let public_key = PublicKey::from(&private_key);

    KeyPair {
        private_key: private_key.to_bytes().to_vec(),
        public_key: public_key.as_bytes().to_vec(),
    }
}

#[wasm_bindgen]
pub fn generate_shared_secret(our_private_key: &[u8], other_public_key: &[u8]) -> Result<Vec<u8>> {
    let our_private_key: [u8; 32] = our_private_key
        .try_into()
        .context("Private key must be exactly 32 bytes.")?;
    let other_public_key: [u8; 32] = other_public_key
        .try_into()
        .context("Public key must be exactly 32 bytes.")?;

    let private_key = StaticSecret::from(our_private_key);
    let public_key = PublicKey::from(other_public_key);

    let shared_secret = private_key.diffie_hellman(&public_key);

    let hkdf = Hkdf::<Sha256>::new(None, shared_secret.as_bytes());
    let mut okm = [0u8; 32];

    hkdf.expand(b"thiscrow-chat-encryption", &mut okm)
        .map_err(|_| anyhow!("HKDF expand operation failed."))?;

    Ok(okm.to_vec())
}

#[wasm_bindgen]
pub fn generate_nonce() -> Result<Vec<u8>> {
    let mut nonce = [0u8; 12];
    getrandom(&mut nonce).map_err(|e| anyhow!("Failed to generate random nonce: {}", e))?;
    Ok(nonce.to_vec())
}

#[wasm_bindgen]
pub fn encrypt_message(
    shared_secret: &[u8],
    plaintext: &[u8],
    nonce_bytes: &[u8],
) -> Result<Vec<u8>> {
    if shared_secret.len() != 32 {
        bail!("Shared secret must be exactly 32 bytes.");
    }
    if nonce_bytes.len() != 12 {
        bail!("Nonce must be exactly 12 bytes.");
    }

    let key = aes_gcm::Key::<Aes256Gcm>::from_slice(shared_secret);
    let cipher = Aes256Gcm::new(key);
    let nonce = Nonce::from_slice(nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| anyhow!("Encryption failed: {}", e))?;

    Ok(ciphertext)
}

#[wasm_bindgen]
pub fn decrypt_message(
    shared_secret: &[u8],
    ciphertext: &[u8],
    nonce_bytes: &[u8],
) -> Result<Vec<u8>> {
    if shared_secret.len() != 32 {
        bail!("Shared secret must be exactly 32 bytes.");
    }
    if nonce_bytes.len() != 12 {
        bail!("Nonce must be exactly 12 bytes.");
    }

    let key = aes_gcm::Key::<Aes256Gcm>::from_slice(shared_secret);
    let cipher = Aes256Gcm::new(key);
    let nonce = Nonce::from_slice(nonce_bytes);

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| anyhow!("Decryption failed: {}", e))?;

    Ok(plaintext)
}
