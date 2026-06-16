import json
import urllib.request
import urllib.error

base_url = "http://127.0.0.1:8000/api/auth"

def test_otp_flow():
    # 1. Send OTP
    send_url = f"{base_url}/send-otp/"
    data = json.dumps({"phone": "+15550192834"}).encode("utf-8")
    
    req = urllib.request.Request(
        send_url,
        data=data,
        headers={"Content-Type": "application/json"}
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            print("Send OTP Response:", res_data)
            code = res_data.get("code")
            if not code:
                print("Error: No code returned in debug mode.")
                return
    except urllib.error.HTTPError as e:
        print("Send OTP Failed:", e.read().decode())
        return

    # 2. Verify OTP
    verify_url = f"{base_url}/verify-otp/"
    data = json.dumps({"phone": "+15550192834", "code": code}).encode("utf-8")
    
    req = urllib.request.Request(
        verify_url,
        data=data,
        headers={"Content-Type": "application/json"}
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            print("Verify OTP Response:", res_data)
            print("SUCCESS: OTP flow working perfectly!")
    except urllib.error.HTTPError as e:
        print("Verify OTP Failed:", e.read().decode())

if __name__ == "__main__":
    test_otp_flow()
