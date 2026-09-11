#!/usr/bin/env python3
"""
Ansible Vault 1.1 (AES-256) Compatible Helper Script
Enables encrypting and decrypting vault secrets across Windows, Linux, and macOS
without requiring POSIX-only dependencies.
"""

import os
import sys
import binascii
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import hashes, padding
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives.hmac import HMAC
from cryptography.hazmat.backends import default_backend

VAULT_HEADER = "$ANSIBLE_VAULT;1.1;AES256"


def derive_keys(password: bytes, salt: bytes):
    """Derive key1 (AES), key2 (HMAC), and iv (AES-CTR) using PBKDF2."""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=80,  # 32 (AES key) + 32 (HMAC key) + 16 (IV)
        salt=salt,
        iterations=10000,
        backend=default_backend()
    )
    derived = kdf.derive(password)
    key1 = derived[:32]
    key2 = derived[32:64]
    iv = derived[64:80]
    return key1, key2, iv


def encrypt_vault(plaintext: bytes, password: bytes) -> str:
    """Encrypt plaintext into Ansible Vault 1.1 AES-256 formatted text."""
    salt = os.urandom(32)
    key1, key2, iv = derive_keys(password, salt)

    # AES-CTR encryption with PKCS#7 padding
    cipher = Cipher(algorithms.AES(key1), modes.CTR(iv), backend=default_backend())
    encryptor = cipher.encryptor()
    padder = padding.PKCS7(algorithms.AES.block_size).padder()
    padded_data = padder.update(plaintext) + padder.finalize()
    ciphertext = encryptor.update(padded_data) + encryptor.finalize()

    # HMAC-SHA256 of the ciphertext
    h = HMAC(key2, hashes.SHA256(), backend=default_backend())
    h.update(ciphertext)
    hmac_digest = h.finalize()

    # Combine hex(salt), hex(hmac), hex(ciphertext) separated by newline
    salt_hex = binascii.hexlify(salt)
    hmac_hex = binascii.hexlify(hmac_digest)
    ciphertext_hex = binascii.hexlify(ciphertext)

    inner_payload = b"\n".join([salt_hex, hmac_hex, ciphertext_hex])
    outer_hex = binascii.hexlify(inner_payload).decode("ascii")

    # Format into 80-character chunks
    lines = [VAULT_HEADER]
    for i in range(0, len(outer_hex), 80):
        lines.append(outer_hex[i:i + 80])

    return "\n".join(lines) + "\n"


def decrypt_vault(vault_text: str, password: bytes) -> bytes:
    """Decrypt Ansible Vault 1.1 AES-256 formatted text back to plaintext."""
    lines = vault_text.strip().splitlines()
    if not lines or not lines[0].startswith("$ANSIBLE_VAULT;1.1;AES256"):
        raise ValueError("Invalid or unsupported Ansible Vault header")

    hex_data = "".join(lines[1:]).encode("ascii")
    inner_payload = binascii.unhexlify(hex_data)
    parts = inner_payload.split(b"\n")
    if len(parts) != 3:
        raise ValueError("Corrupted Ansible Vault payload structure")

    salt = binascii.unhexlify(parts[0])
    expected_hmac = binascii.unhexlify(parts[1])
    ciphertext = binascii.unhexlify(parts[2])

    key1, key2, iv = derive_keys(password, salt)

    # Verify HMAC
    h = HMAC(key2, hashes.SHA256(), backend=default_backend())
    h.update(ciphertext)
    h.verify(expected_hmac)

    # Decrypt AES-CTR and unpad PKCS#7
    cipher = Cipher(algorithms.AES(key1), modes.CTR(iv), backend=default_backend())
    decryptor = cipher.decryptor()
    padded_plaintext = decryptor.update(ciphertext) + decryptor.finalize()

    unpadder = padding.PKCS7(algorithms.AES.block_size).unpadder()
    plaintext = unpadder.update(padded_plaintext) + unpadder.finalize()

    return plaintext


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python vault_helper.py <encrypt|decrypt> <input_file> <output_file> [password_or_file]")
        sys.exit(1)

    action = sys.argv[1].lower()
    in_file = sys.argv[2]
    pwd = sys.argv[4] if len(sys.argv) > 4 else os.environ.get("ANSIBLE_VAULT_PASSWORD")
    if not pwd:
        raise ValueError("ANSIBLE_VAULT_PASSWORD environment variable or password argument is required")

    # If password refers to a readable file, read it
    if os.path.isfile(pwd):
        with open(pwd, "rb") as f:
            pwd_bytes = f.read().strip()
    else:
        pwd_bytes = pwd.encode("utf-8")

    if action == "encrypt":
        with open(in_file, "rb") as f:
            data = f.read()
        enc = encrypt_vault(data, pwd_bytes)
        with open(out_file, "w", encoding="utf-8") as f:
            f.write(enc)
        print(f"Encrypted {in_file} -> {out_file} successfully.")

    elif action == "decrypt":
        with open(in_file, "r", encoding="utf-8") as f:
            data = f.read()
        dec = decrypt_vault(data, pwd_bytes)
        with open(out_file, "wb") as f:
            f.write(dec)
        print(f"Decrypted {in_file} -> {out_file} successfully.")
    else:
        print(f"Unknown action: {action}")
        sys.exit(1)
