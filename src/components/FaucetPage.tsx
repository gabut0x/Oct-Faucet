import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Droplets, 
  Clock, 
  Shield, 
  CheckCircle, 
  AlertTriangle,
  ExternalLink,
  Copy
} from 'lucide-react';
import ReCAPTCHA from 'react-google-recaptcha';
import { ThemeToggle } from './ThemeToggle';
import { useToast } from '@/hooks/use-toast';
import { sendFaucetTransaction } from '../utils/faucet';

interface FaucetStats {
  totalClaimed: number;
  totalUsers: number;
  lastClaim: string | null;
}

export function FaucetPage() {
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [stats, setStats] = useState<FaucetStats>({
    totalClaimed: 0,
    totalUsers: 0,
    lastClaim: null
  });
  const [timeUntilNextClaim, setTimeUntilNextClaim] = useState<string | null>(null);
  
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const { toast } = useToast();

  // Replace with your actual reCAPTCHA site key
  const RECAPTCHA_SITE_KEY = "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"; // Test key

  const validateAddress = (addr: string): boolean => {
    return addr.startsWith('oct') && addr.length > 10;
  };

  const formatTimeRemaining = (hours: number): string => {
    if (hours <= 0) return "Available now";
    if (hours < 1) {
      const minutes = Math.ceil(hours * 60);
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    const wholeHours = Math.floor(hours);
    const minutes = Math.ceil((hours - wholeHours) * 60);
    if (minutes === 0) {
      return `${wholeHours} hour${wholeHours !== 1 ? 's' : ''}`;
    }
    return `${wholeHours}h ${minutes}m`;
  };

  const handleClaim = async () => {
    if (!address.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid Octra address",
        variant: "destructive",
      });
      return;
    }

    if (!validateAddress(address.trim())) {
      toast({
        title: "Error",
        description: "Invalid Octra address format. Address must start with 'oct'",
        variant: "destructive",
      });
      return;
    }

    const recaptchaValue = recaptchaRef.current?.getValue();
    if (!recaptchaValue) {
      toast({
        title: "Error",
        description: "Please complete the reCAPTCHA verification",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const result = await sendFaucetTransaction(address.trim(), recaptchaValue);
      
      if (result.success) {
        setLastTxHash(result.txHash || null);
        toast({
          title: "Success!",
          description: `Successfully sent 10 OCT to your address. Transaction hash: ${result.txHash?.slice(0, 16)}...`,
        });
        
        // Update stats
        setStats(prev => ({
          totalClaimed: prev.totalClaimed + 10,
          totalUsers: prev.totalUsers + 1,
          lastClaim: new Date().toISOString()
        }));
        
        // Set next claim time (24 hours for address)
        setTimeUntilNextClaim("24 hours");
        
        // Reset form
        setAddress('');
        recaptchaRef.current?.reset();
      } else {
        toast({
          title: "Claim Failed",
          description: result.error || "Failed to process faucet claim",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Faucet claim error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-500 rounded-full">
                  <Droplets className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Octra Faucet</h1>
                  <p className="text-sm text-muted-foreground">Free OCT tokens for testing</p>
                </div>
              </div>
              <Badge variant="secondary" className="hidden sm:inline-flex">
                Non-Official
              </Badge>
            </div>

            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center space-x-4 text-sm text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <Droplets className="h-4 w-4" />
                  <span>{stats.totalClaimed.toFixed(1)} OCT claimed</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Shield className="h-4 w-4" />
                  <span>{stats.totalUsers} users</span>
                </div>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Faucet Form */}
          <div className="lg:col-span-2">
            <Card className="shadow-xl border-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
              <CardHeader className="text-center">
                <CardTitle className="text-3xl flex items-center justify-center gap-3">
                  <Droplets className="h-8 w-8 text-blue-500" />
                  Claim Free OCT
                </CardTitle>
                <p className="text-muted-foreground">
                  Get 10 OCT tokens for testing on the Octra blockchain
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Rate Limiting Info */}
                <Alert>
                  <Clock className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Rate Limits:</strong> 1 claim per address every 24 hours • 1 claim per IP every hour
                  </AlertDescription>
                </Alert>

                {/* Address Input */}
                <div className="space-y-2">
                  <Label htmlFor="address">Octra Address</Label>
                  <Input
                    id="address"
                    type="text"
                    placeholder="oct1234567890abcdef..."
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="font-mono"
                    disabled={isLoading}
                  />
                  <p className="text-sm text-muted-foreground">
                    Enter your Octra wallet address (must start with 'oct')
                  </p>
                </div>

                {/* reCAPTCHA */}
                <div className="flex justify-center">
                  <ReCAPTCHA
                    ref={recaptchaRef}
                    sitekey={RECAPTCHA_SITE_KEY}
                    theme="light"
                  />
                </div>

                {/* Next Claim Timer */}
                {timeUntilNextClaim && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Next claim available in: <strong>{timeUntilNextClaim}</strong>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Claim Button */}
                <Button 
                  onClick={handleClaim}
                  disabled={isLoading || !address.trim()}
                  className="w-full"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <Droplets className="h-4 w-4 mr-2" />
                      Claim 10 OCT
                    </>
                  )}
                </Button>

                {/* Last Transaction */}
                {lastTxHash && (
                  <div className="p-4 bg-green-50 dark:bg-green-950/50 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mr-2 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-green-800 dark:text-green-200">
                          Transaction Successful!
                        </p>
                        <div className="mt-2">
                          <p className="text-green-700 dark:text-green-300 text-sm">Transaction Hash:</p>
                          <div className="flex items-center mt-1">
                            <code className="text-xs bg-green-100 dark:bg-green-900/50 px-2 py-1 rounded font-mono break-all text-green-800 dark:text-green-200">
                              {lastTxHash}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(lastTxHash, 'Transaction Hash')}
                              className="ml-2 h-6 w-6 p-0"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <a
                              href={`https://octrascan.io/tx/${lastTxHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                              title="View on OctraScan"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Stats Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Faucet Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Claimed:</span>
                  <span className="font-mono font-medium">{stats.totalClaimed.toFixed(1)} OCT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Users:</span>
                  <span className="font-mono font-medium">{stats.totalUsers}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount per Claim:</span>
                  <span className="font-mono font-medium">10 OCT</span>
                </div>
                {stats.lastClaim && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Claim:</span>
                    <span className="text-sm">{new Date(stats.lastClaim).toLocaleTimeString()}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <Separator className="my-8" />

        {/* Footer */}
        <footer className="text-center text-sm text-muted-foreground">
          <p className="mb-2">
            This is a <strong>non-official</strong> faucet for the Octra blockchain.
          </p>
          <p>
            Use responsibly and only for testing purposes. Rate limits are enforced to ensure fair distribution.
          </p>
        </footer>
      </main>
    </div>
  );
}