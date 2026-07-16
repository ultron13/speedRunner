FROM alpine/jmeter:5.6

# Install plugins manager
RUN wget -O /opt/jmeter/lib/ext/jmeter-plugins-manager.jar \
    https://jmeter-plugins.org/downloads/latest/jmeter-plugins-manager.jar 2>/dev/null || true

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
