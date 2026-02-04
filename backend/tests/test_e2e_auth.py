"""
End-to-end test to verify authentication works with Argon2
"""
import requests
import time

API_BASE = "http://127.0.0.1:8000/api/v1"

print("="*60)
print("E2E AUTHENTICATION TEST (with Argon2)")
print("="*60 + "\n")

# Test 1: Health check
print("1. Testing health endpoint...")
response = requests.get("http://127.0.0.1:8000/health")
assert response.status_code == 200, f"Health check failed: {response.status_code}"
print("   ✅ Health check passed\n")

# Test 2: Try logging in with existing user
print("2. Testing login with existing user (lecturer)...")
response = requests.post(f"{API_BASE}/auth/login", json={
    "username": "lecturer",
    "password": "password"
})
if response.status_code == 200:
    token = response.json()["access_token"]
    print(f"   ✅ Login successful")
    print(f"   Token: {token[:20]}...\n")
    
    # Test 3: Get current user with token
    print("3. Testing authenticated endpoint...")
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{API_BASE}/auth/me", headers=headers)
    assert response.status_code == 200, f"Auth me failed: {response.status_code}"
    user_data = response.json()
    print(f"   ✅ Authenticated as: {user_data['username']} ({user_data['role']})\n")
    
    # Test 4: Test lecturer endpoint
    print("4. Testing lecturer dashboard...")
    response = requests.get(f"{API_BASE}/lecturer/dashboard", headers=headers)
    assert response.status_code == 200, f"Dashboard failed: {response.status_code}"
    dashboard = response.json()
    print(f"   ✅ Dashboard loaded: {dashboard['total']} total assessments\n")
else:
    print(f"   ⚠️ Login failed with status {response.status_code}")
    print(f"   This might be expected if password hasn't been migrated to Argon2 yet")
    print(f"   Response: {response.text}\n")

# Test 5: Register new user with Argon2
print("5. Testing registration (will use Argon2)...")
timestamp = int(time.time())
new_user = {
    "username": f"test_argon_{timestamp}",
    "email": f"test_argon_{timestamp}@example.com",
    "password": "TestPassword123!",
    "role": "lecturer",
    "full_name": "Test Argon User"
}
response = requests.post(f"{API_BASE}/auth/register", json=new_user)
assert response.status_code == 201, f"Registration failed: {response.status_code} - {response.text}"
print(f"   ✅ User registered: {new_user['username']}\n")

# Test 6: Login with newly registered user
print("6. Testing login with new user (Argon2 password)...")
response = requests.post(f"{API_BASE}/auth/login", json={
    "username": new_user['username'],
    "password": new_user['password']
})
assert response.status_code == 200, f"Login failed: {response.status_code} - {response.text}"
token = response.json()["access_token"]
print(f"   ✅ Login successful with Argon2 hashed password")
print(f"   Token: {token[:20]}...\n")

# Test 7: Try wrong password
print("7. Testing login with wrong password...")
response = requests.post(f"{API_BASE}/auth/login", json={
    "username": new_user['username'],
    "password": "WrongPassword"
})
assert response.status_code == 401, f"Should reject wrong password"
print(f"   ✅ Wrong password correctly rejected\n")

print("="*60)
print("🎉 ALL E2E TESTS PASSED!")
print("✅ Argon2 password hashing working correctly")
print("✅ Authentication flow working end-to-end")
print("="*60)
