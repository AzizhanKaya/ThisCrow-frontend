use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct Error(String);

impl From<anyhow::Error> for Error {
    fn from(error: anyhow::Error) -> Self {
        log::warn!("{:#}", error);
        Self(format!("{:#}", error))
    }
}

pub type Result<T> = std::result::Result<T, Error>;
