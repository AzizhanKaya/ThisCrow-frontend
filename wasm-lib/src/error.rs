use wasm_bindgen::JsValue;

#[macro_export]
macro_rules! bail {
    ($($arg:tt)*) => {
        return Err(anyhow::anyhow!($($arg)*).into())
    };
}

pub struct Error(anyhow::Error);

pub type Result<T> = core::result::Result<T, Error>;

impl From<anyhow::Error> for Error {
    fn from(e: anyhow::Error) -> Self {
        Error(e)
    }
}

impl From<Error> for JsValue {
    fn from(err: Error) -> Self {
        JsValue::from_str(&format!("{:#}", err.0))
    }
}
