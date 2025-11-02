FROM budtmo/docker-android:emulator_12.0-google_apis-x86_64-nexus-5

# Label for security research purposes
LABEL maintainer="Android Sandbox Security Team"
LABEL description="Android Emulator with Security Analysis Tools"
LABEL version="1.0"

# Install system dependencies and security analysis tools
USER root
RUN apt-get update && apt-get install -y \
    # Network analysis tools
    tcpdump \
    nmap \
    wireshark-common \
    netcat \
    curl \
    wget \
    # System monitoring and debugging
    strace \
    ltrace \
    gdb \
    htop \
    procps \
    # Python for analysis scripts
    python3 \
    python3-pip \
    # Node.js for Frida
    nodejs \
    npm \
    # Filesystem analysis
    binutils \
    file \
    hexdump \
    # Utilities
    vim \
    nano \
    git \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install Frida
RUN npm install -g frida

# Install Python analysis packages
RUN pip3 install \
    frida-tools \
    requests \
    scapy \
    pyyaml \
    cryptography

# Create directories for analysis tools and data
RUN mkdir -p /opt/analysis-tools \
    && mkdir -p /opt/captures \
    && mkdir -p /opt/logs \
    && mkdir -p /opt/scripts

# Copy analysis scripts and templates
COPY tools/frida-scripts/ /opt/analysis-tools/frida/
COPY tools/tcpdump-filters/ /opt/analysis-tools/tcpdump/
COPY tools/analysis-templates/ /opt/analysis-tools/templates/

# Set up environment variables for analysis
ENV ANDROID_SDK_ROOT=/opt/android-sdk
ENV ANDROID_HOME=/opt/android-sdk
ENV FRIDA_TARGET=android
ENV ANALYSIS_HOME=/opt/analysis-tools

# Create analysis user with sudo access
RUN useradd -m -s /bin/bash analyst && \
    echo 'analyst ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

# Set ownership and permissions
RUN chown -R analyst:analyst /opt/analysis-tools && \
    chown -R analyst:analyst /opt/captures && \
    chown -R analyst:analyst /opt/logs

# Copy startup scripts
COPY scripts/ /opt/scripts/
RUN chmod +x /opt/scripts/*.sh

# Switch to analyst user
USER analyst

# Expose ADB and VNC ports
EXPOSE 5555 5900

# Health check to verify emulator is running
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD adb devices | grep -q "emulator-5554"

# Set working directory
WORKDIR /home/analyst

# Default command to start emulator with analysis tools
CMD ["/opt/scripts/start-emulator.sh"]