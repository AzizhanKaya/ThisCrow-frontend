use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn greet(name: &str) -> String {
    format!("Merhaba {}, Rust WASM modülünden selamlar!", name)
}

#[wasm_bindgen]
pub fn topla(a: i32, b: i32) -> i32 {
    a + b
}
