#[cfg(target_os = "linux")]
pub fn install_stderr_filter() {
    use std::io::{BufRead, BufReader, Write};
    use std::os::fd::FromRawFd;

    let mut fds = [0i32; 2];
    if unsafe { libc::pipe(fds.as_mut_ptr()) } != 0 {
        return;
    }
    let read_fd = fds[0];
    let write_fd = fds[1];

    let original_stderr = unsafe { libc::dup(libc::STDERR_FILENO) };
    if original_stderr < 0 {
        unsafe {
            libc::close(read_fd);
            libc::close(write_fd);
        }
        return;
    }

    if unsafe { libc::dup2(write_fd, libc::STDERR_FILENO) } < 0 {
        unsafe {
            libc::close(read_fd);
            libc::close(write_fd);
            libc::close(original_stderr);
        }
        return;
    }
    unsafe { libc::close(write_fd) };

    std::thread::spawn(move || {
        let reader = unsafe { std::fs::File::from_raw_fd(read_fd) };
        let mut writer = unsafe { std::fs::File::from_raw_fd(original_stderr) };
        let buf = BufReader::new(reader);
        for line in buf.lines() {
            let Ok(line) = line else { break };
            if is_noise(&line) {
                continue;
            }
            let _ = writeln!(writer, "{}", strip_screen_clears(&line));
            let _ = writer.flush();
        }
    });
}

#[cfg(not(target_os = "linux"))]
pub fn install_stderr_filter() {}

#[cfg(target_os = "linux")]
fn is_noise(line: &str) -> bool {
    line.contains("GStreamer-CRITICAL")
}

#[cfg(target_os = "linux")]
fn strip_screen_clears(line: &str) -> String {
    let bytes = line.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == 0x1b && i + 1 < bytes.len() {
            match bytes[i + 1] {
                b'c' => {
                    i += 2;
                    continue;
                }
                b'[' => {
                    let mut j = i + 2;
                    while j < bytes.len() && !(0x40..=0x7e).contains(&bytes[j]) {
                        j += 1;
                    }
                    if j < bytes.len() {
                        let terminator = bytes[j];
                        let params = &bytes[i + 2..j];
                        let drop = terminator == b'J'
                            || ((terminator == b'h' || terminator == b'l') && params == b"?1049");
                        if drop {
                            i = j + 1;
                            continue;
                        }
                        out.extend_from_slice(&bytes[i..=j]);
                        i = j + 1;
                        continue;
                    }
                }
                _ => {}
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}
