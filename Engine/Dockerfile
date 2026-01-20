FROM odoo:16.0

USER root

# Install dependencies for Kafka integration (and other potential needs)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3-pip \
    git \
    build-essential \
    python3-dev \
    libsasl2-dev \
    libldap2-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Install specific python libraries
# kafka-python or confluent-kafka can be used. using kafka-python for simplicity in typical odoo contexts
RUN pip3 install kafka-python prometheus-client requests

USER odoo

# Copy entrypoint or configuration if needed (mostly mapped via volumes in dev, but good for prod)
COPY ./odoo.conf /etc/odoo/odoo.conf
COPY ./entrypoint_wrapper.sh /entrypoint_wrapper.sh

USER root
RUN chmod +x /entrypoint_wrapper.sh
USER odoo

ENTRYPOINT ["/entrypoint_wrapper.sh"]
CMD ["odoo"]
