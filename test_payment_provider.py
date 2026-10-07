import json

import payment_provider


def test_mtn_initiates_request_to_pay(monkeypatch):
    settings = payment_provider.settings
    settings.mtn_momo_api_user = "api-user"
    settings.mtn_momo_api_key = "api-key"
    settings.mtn_momo_subscription_key = "subscription-key"
    settings.mtn_momo_target_env = "sandbox"
    settings.mtn_momo_base_url = "https://mtn.example"

    requests = []

    def fake_request(url, method, headers, body=None):
        requests.append((url, method, headers, body))
        if url.endswith("/collection/token/"):
            return b'{"access_token":"token"}'
        return b""

    monkeypatch.setattr(payment_provider, "_request", fake_request)
    result = payment_provider.MtnMomoProvider().initiate(50, "mtn_momo", "+260971234567", "pupil@example.com")

    assert result.status == "pending"
    assert requests[0][2]["Content-Type"] == "application/x-www-form-urlencoded"
    assert requests[1][0] == "https://mtn.example/collection/v1_0/requesttopay"
    assert requests[1][2]["Authorization"] == "Bearer token"
    assert json.loads(requests[1][3])["currency"] == "ZMW"


def test_dpo_returns_hosted_checkout_url_and_escapes_xml(monkeypatch):
    settings = payment_provider.settings
    settings.dpo_company_token = "company&token"
    settings.dpo_service_type = "service<type"
    settings.dpo_base_url = "https://dpo.example/API/v6/"
    settings.dpo_checkout_url = "https://dpo.example/payv3.php"
    settings.site_url = "https://smartclass.example"

    captured = {}

    def fake_request(url, method, headers, body=None):
        captured.update(url=url, method=method, headers=headers, body=body)
        return b"<API3G><Result>000</Result><TransToken>token-123</TransToken></API3G>"

    monkeypatch.setattr(payment_provider, "_request", fake_request)
    result = payment_provider.DpoCardProvider().initiate(50, "visa", None, "Ada&Lovelace@example.com")

    assert result.status == "pending"
    assert result.provider_reference == "token-123"
    assert result.instructions == "Redirect to https://dpo.example/payv3.php?ID=token-123"
    xml = captured["body"].decode()
    assert "company&amp;token" in xml
    assert "service&lt;type" in xml
    assert "Ada&amp;Lovelace@example.com" in xml
