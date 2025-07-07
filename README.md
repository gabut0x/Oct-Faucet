# Octra Faucet

A non-official faucet for the Octra blockchain that provides free OCT tokens for testing purposes.

## Features

- 🚰 **Free OCT Tokens**: Get 10 OCT tokens per claim
- ⏰ **Rate Limiting**: 1 claim per address every 24 hours, 1 claim per IP every hour
- 🛡️ **Google reCAPTCHA**: Bot protection with reCAPTCHA verification
- 🎨 **Modern UI**: Built with shadcn/ui components and Tailwind CSS
- 🌙 **Dark Mode**: Toggle between light and dark themes
- 📱 **Responsive**: Works on all device sizes
- 🔗 **Blockchain Integration**: Direct integration with Octra network RPC

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI Components**: shadcn/ui + Radix UI
- **Styling**: Tailwind CSS
- **Blockchain**: Octra network integration
- **Security**: Google reCAPTCHA v2
- **Crypto**: TweetNaCl for transaction signing

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd octra-faucet
```

2. Install dependencies:
```bash
npm install
```

3. Configure the faucet:
   - Update `src/utils/faucet.ts` with your actual faucet wallet credentials
   - Replace the reCAPTCHA site key in `src/components/FaucetPage.tsx`

4. Start the development server:
```bash
npm run dev
```

## Configuration

### Faucet Settings

Edit `src/utils/faucet.ts` to configure:

- `FAUCET_AMOUNT`: Amount of OCT tokens per claim (default: 10)
- `FAUCET_PRIVATE_KEY`: Your faucet wallet's private key (Base64)
- `FAUCET_PUBLIC_KEY`: Your faucet wallet's public key (Hex)
- `FAUCET_ADDRESS`: Your faucet wallet's address

### reCAPTCHA Setup

1. Get a reCAPTCHA site key from [Google reCAPTCHA](https://www.google.com/recaptcha/)
2. Replace `RECAPTCHA_SITE_KEY` in `src/components/FaucetPage.tsx`

### Rate Limiting

Current rate limits:
- **Per Address**: 1 claim every 24 hours
- **Per IP**: 1 claim every hour

Modify the rate limiting logic in `src/utils/faucet.ts` as needed.

## Production Deployment

For production deployment:

1. Set up a proper backend for:
   - Rate limiting with persistent storage
   - reCAPTCHA verification
   - Transaction queue management
   - Monitoring and analytics

2. Secure your faucet wallet:
   - Use environment variables for sensitive data
   - Implement proper key management
   - Set up monitoring for wallet balance

3. Configure proper CORS and security headers

## Security Considerations

- **Rate Limiting**: Implement robust rate limiting to prevent abuse
- **reCAPTCHA**: Always verify reCAPTCHA tokens on the backend
- **Wallet Security**: Keep faucet private keys secure and monitor balance
- **Input Validation**: Validate all user inputs, especially addresses
- **Monitoring**: Set up alerts for unusual activity

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the MIT License.

## Disclaimer

This is a **non-official** faucet for the Octra blockchain. Use at your own risk and only for testing purposes. The developers are not responsible for any loss of funds or misuse of the faucet.

## Support

For issues and questions:
- Open an issue on GitHub
- Check the Octra community channels
- Review the documentation

---

**Note**: Remember to replace placeholder values with actual configuration before deploying to production.