# =============================================================================
#  WebKitGTK (webkit2gtk-4.1) + WebRTC + Tauri v2 / Rust
#  CI imajı — tauri-build.yml içindeki container job'u için tasarlandı
# =============================================================================
ARG BASE_IMAGE=ubuntu:22.04
FROM ${BASE_IMAGE}

ARG WEBKIT_VERSION=2.48.6
ARG JOBS=4
ENV DEBIAN_FRONTEND=noninteractive

# -----------------------------------------------------------------------------
# 1) Derleme araçları + WebKitGTK bağımlılıkları + ccache
# -----------------------------------------------------------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
    # --- derleme araçları ve ccache (Derleme hızlandırma için eklendi) ---
    build-essential gcc-12 g++-12 cmake ninja-build pkg-config lld ccache \
    ruby gperf unifdef python3 gettext \
    wget curl ca-certificates xz-utils git \
    # --- GTK3 / soup3 / temel ---
    libgtk-3-dev libsoup-3.0-dev libglib2.0-dev \
    libgcrypt20-dev libtasn1-6-dev libgpg-error-dev libssl-dev \
    libxml2-dev libxslt1-dev libsqlite3-dev libsecret-1-dev \
    libhyphen-dev libenchant-2-dev libnotify-dev libgudev-1.0-dev \
    libicu-dev libharfbuzz-dev \
    # --- görüntü/kodek ---
    libjpeg-dev libpng-dev libwebp-dev libavif-dev liblcms2-dev \
    libwoff-dev \
    # --- grafik / GL / wayland / drm ---
    libegl-dev libgles-dev libepoxy-dev libdrm-dev libgbm-dev \
    libwayland-dev wayland-protocols libxkbcommon-dev libxt-dev \
    # --- sandbox/sistem ---
    libseccomp-dev libsystemd-dev \
    # --- GStreamer ---
    libgstreamer1.0-dev libgstreamer-plugins-base1.0-dev \
    libgstreamer-plugins-bad1.0-dev \
    # --- WebRTC ICE backend ---
    libnice-dev \
    && rm -rf /var/lib/apt/lists/*

# -----------------------------------------------------------------------------
# 2) WebKitGTK kaynağını çek, ccache ile WebRTC açık derle, /usr/local'a kur
#    --mount=type=cache yardımıyla derleme yarıda kalsa bile ilerleme kaybolmaz.
# -----------------------------------------------------------------------------
RUN --mount=type=cache,target=/root/.cache/ccache \
    export CC="/usr/bin/ccache gcc-12" \
    export CXX="/usr/bin/ccache g++-12" \
    export CCACHE_DIR=/root/.cache/ccache \
    export CCACHE_MAXSIZE=15G \
    cd /tmp \
    && wget -q "https://webkitgtk.org/releases/webkitgtk-${WEBKIT_VERSION}.tar.xz" \
    && tar xf "webkitgtk-${WEBKIT_VERSION}.tar.xz" \
    && cd "webkitgtk-${WEBKIT_VERSION}" \
    && cmake -S . -B build -G Ninja \
    -DPORT=GTK \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_INSTALL_PREFIX=/usr/local \
    -DUSE_SOUP2=OFF \
    -DUSE_GTK4=OFF \
    -DUSE_JPEGXL=OFF \
    -DUSE_LIBBACKTRACE=OFF \
    -DENABLE_WEB_RTC=ON \
    -DENABLE_MEDIA_STREAM=ON \
    -DENABLE_GAMEPAD=OFF \
    -DENABLE_INTROSPECTION=OFF \
    -DENABLE_SPEECH_SYNTHESIS=OFF \
    -DENABLE_BUBBLEWRAP_SANDBOX=OFF \
    -DENABLE_DOCUMENTATION=OFF \
    -DENABLE_MINIBROWSER=ON \
    -DCMAKE_SHARED_LINKER_FLAGS="-fuse-ld=lld" \
    -DCMAKE_EXE_LINKER_FLAGS="-fuse-ld=lld" \
    && ninja -C build -j "${JOBS}" \
    && ninja -C build install \
    && echo "/usr/local/lib" > /etc/ld.so.conf.d/usrlocal.conf \
    && echo "/usr/local/lib/x86_64-linux-gnu" >> /etc/ld.so.conf.d/usrlocal.conf \
    && ldconfig \
    && cd / && rm -rf /tmp/webkitgtk-*

# Ortam değişkenleri
ENV PKG_CONFIG_PATH=/usr/local/lib/pkgconfig:/usr/local/lib/x86_64-linux-gnu/pkgconfig
ENV LD_LIBRARY_PATH=/usr/local/lib:/usr/local/lib/x86_64-linux-gnu
ENV GI_TYPELIB_PATH=/usr/local/lib/girepository-1.0:/usr/local/lib/x86_64-linux-gnu/girepository-1.0

# -----------------------------------------------------------------------------
# 3) Tauri Linux paketleme + çalışma-zamanı GStreamer eklentileri
# -----------------------------------------------------------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
    file patchelf desktop-file-utils \
    librsvg2-dev libayatana-appindicator3-dev libxdo-dev \
    gstreamer1.0-plugins-base gstreamer1.0-plugins-good \
    gstreamer1.0-plugins-bad gstreamer1.0-nice gstreamer1.0-libav \
    gstreamer1.0-pipewire \
    && rm -rf /var/lib/apt/lists/*

# -----------------------------------------------------------------------------
# 4) Node.js 24 + pnpm + Rust + Tauri CLI v2 + wasm-pack
# -----------------------------------------------------------------------------
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable \
    && corepack prepare pnpm@9 --activate

ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH=/usr/local/cargo/bin:$PATH
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
    | sh -s -- -y --default-toolchain stable --profile minimal \
    && cargo install tauri-cli --version "^2.0.0" --locked \
    && cargo install wasm-pack --locked

WORKDIR /app
CMD ["bash"]