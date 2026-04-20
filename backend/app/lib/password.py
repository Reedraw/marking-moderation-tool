# Import the Argon2 password hashing library 
from argon2 import PasswordHasher
# Import the specific exception raised when password verification fails
from argon2.exceptions import VerifyMismatchError

# Create a single PasswordHasher instance with default Argon2id parameters
# Reusing one instance is more efficient than creating new ones per request
ph = PasswordHasher()

def get_password_hash(password: str) -> str:
    """
    Hash a plaintext password using Argon2id algorithm.
    The hash includes a random salt, so the same password produces different hashes each time.
    This is called during user registration to store the hashed password in the database.

    :param password: The plaintext password to hash.
    :return: The hashed password string (includes algorithm params, salt, and hash).
    """
    return ph.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plaintext password against a stored Argon2 hash.
    This is called during login to check if the entered password matches.

    :param plain_password: The plaintext password entered by the user.
    :param hashed_password: The stored hash from the database.
    :return: True if the password matches the hash, False otherwise.
    """
    try:
        # ph.verify() returns True if match, raises VerifyMismatchError if not
        return ph.verify(hashed_password, plain_password)
    except VerifyMismatchError:
        # Password doesn't match - return False instead of letting exception propagate
        return False
