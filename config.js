// Live: prices, sign-up and payments go to the clients' Supabase project (Stripe in TEST mode until go-live).
// stripeKey: Stripe PUBLISHABLE key (public by design); paid checkouts use the key returned by public-api.
window.LW_CONFIG = {
  appUrl: 'https://app.loosesandwins.com',
  apiUrl: 'https://duqwwdhxjxzklasscszh.supabase.co/functions/v1/public-api',
  stripeKey: 'pk_test_51UYCIkGkdb82BBexX8KHpytlwOaMnCTSA7cSp92ZKmwsSnMuilp3SaWDZXHj3gymY53SPD3xhUvZ9zDUr9VHkvRZ00kkV3yePb',
};
