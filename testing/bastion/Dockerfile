FROM alpine:latest

RUN apk add --no-cache openssh

# Create SSH user and unlock account for key-based auth
RUN adduser -D -s /bin/sh sshdemo && \
    passwd -u sshdemo && \
    mkdir -p /home/sshdemo/.ssh && \
    chmod 700 /home/sshdemo/.ssh && \
    chown -R sshdemo:sshdemo /home/sshdemo/.ssh

# Copy SSH config
COPY sshd_config /etc/ssh/sshd_config
COPY authorized_keys /home/sshdemo/.ssh/authorized_keys

RUN chmod 600 /home/sshdemo/.ssh/authorized_keys && \
    chown sshdemo:sshdemo /home/sshdemo/.ssh/authorized_keys

# Generate host keys
RUN ssh-keygen -A

EXPOSE 22

CMD ["/usr/sbin/sshd", "-D", "-e"]
