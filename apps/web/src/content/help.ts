export const HELP: { section: string; items: { q: string; a: string }[] }[] = [
  {
    section: "Buying",
    items: [
      { q: "Why can't I buy some products?", a: "Products marked Coming soon don't have a finished, tested deliverable yet. Add them to your wishlist to be notified when they're released." },
      { q: "Which payment methods do you accept?", a: "Payments are processed by our payment provider's hosted checkout (cards and local methods it supports). In development environments a clearly labelled sandbox is used and no money moves." },
      { q: "How is VAT calculated?", a: "Prices exclude VAT. At checkout VAT is calculated for your country. EU businesses with a validated VAT ID may be charged under reverse charge." },
      { q: "When do I get access?", a: "As soon as the payment provider confirms your payment, usually within seconds. The confirmation page refreshes automatically." },
      { q: "Do discount codes stack?", a: "No. One code per order." },
    ],
  },
  {
    section: "Using products",
    items: [
      { q: "What's the difference between sandbox and live runs?", a: "Live runs call an AI model (OpenAI, Anthropic or Gemini). Sandbox runs use deterministic code so you can test inputs and outputs without an AI provider; their output is labelled Simulated." },
      { q: "What are credits?", a: "Credits pay for live-model runs on hosted products. 1 credit is about €0.01 of estimated provider cost. Purchases of hosted products include credits." },
      { q: "Can I use my own API key?", a: "Yes. Add it under Dashboard → Integrations. Runs of products you own then use your key and don't consume credits." },
      { q: "Why did my run stop?", a: "Every run has limits on steps, tokens, cost and time. The error message tells you which limit was hit. Shorten your input or choose a different model." },
      { q: "Where are my downloads?", a: "Dashboard → Downloads. Links are signed, tied to your account and expire after five minutes; reload the page for a fresh link." },
    ],
  },
  {
    section: "Account & data",
    items: [
      { q: "How do I verify my email?", a: "Click the link in the verification email. You can resend it from the Verify page." },
      { q: "How do I export or delete my data?", a: "Dashboard → Settings has an export button and an account deletion form." },
      { q: "Is my data used to train models?", a: "AgentForge does not train models on your data. Live runs send the necessary input to the AI provider you choose; see the Privacy Policy." },
    ],
  },
];
