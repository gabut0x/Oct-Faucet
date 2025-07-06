import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, Trash2, AlertTriangle, Wallet as WalletIcon, CheckCircle, ExternalLink } from 'lucide-react';
import { Wallet } from '../types/wallet';
import { fetchBalance, sendTransaction, createTransaction } from '../utils/api';
import { useToast } from '@/hooks/use-toast';

interface Recipient {
  address: string;
  amount: string;
}

interface MultiSendProps {
  wallet: Wallet | null;
  balance: number | null;
  onBalanceUpdate: (balance: number) => void;
  onTransactionSuccess: () => void;
}

export function MultiSend({ wallet, balance, onBalanceUpdate, onTransactionSuccess }: MultiSendProps) {
  const [recipients, setRecipients] = useState<Recipient[]>([
    { address: '', amount: '' }
  ]);
  const [isSending, setIsSending] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [results, setResults] = useState<Array<{ success: boolean; hash?: string; error?: string; recipient: string; amount: string }>>([]);
  const { toast } = useToast();

  // Fetch nonce when wallet changes
  useEffect(() => {
    const fetchWalletData = async () => {
      if (wallet) {
        try {
          const balanceData = await fetchBalance(wallet.address);
          setNonce(balanceData.nonce);
          // Update balance if it's different
          if (balance !== balanceData.balance) {
            onBalanceUpdate(balanceData.balance);
          }
        } catch (error) {
          console.error('Failed to fetch wallet data:', error);
        }
      }
    };
    fetchWalletData();
  }, [wallet]);

  const addRecipient = () => {
    setRecipients([...recipients, { address: '', amount: '' }]);
  };

  const removeRecipient = (index: number) => {
    if (recipients.length > 1) {
      setRecipients(recipients.filter((_, i) => i !== index));
    }
  };

  const updateRecipient = (index: number, field: keyof Recipient, value: string) => {
    const updated = recipients.map((recipient, i) => 
      i === index ? { ...recipient, [field]: value } : recipient
    );
    setRecipients(updated);
  };

  const validateRecipients = () => {
    for (const recipient of recipients) {
      if (!recipient.address || !recipient.amount) {
        return false;
      }
      if (isNaN(Number(recipient.amount)) || Number(recipient.amount) <= 0) {
        return false;
      }
    }
    return true;
  };

  const getTotalAmount = () => {
    return recipients.reduce((total, recipient) => {
      return total + (Number(recipient.amount) || 0);
    }, 0);
  };

  const handleSendMultiple = async () => {
    if (!wallet) {
      toast({
        title: "Error",
        description: "No wallet available",
        variant: "destructive",
      });
      return;
    }

    if (!validateRecipients()) {
      toast({
        title: "Error",
        description: "Please fill in all recipient addresses and amounts",
        variant: "destructive",
      });
      return;
    }

    const totalAmount = getTotalAmount();
    if (balance !== null && totalAmount > balance) {
      toast({
        title: "Error",
        description: "Insufficient balance for this transaction",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    setResults([]);

    try {
      // Refresh nonce before sending
      const freshBalanceData = await fetchBalance(wallet.address);
      let currentNonce = freshBalanceData.nonce;

      const validRecipients = recipients.filter(r => r.address && Number(r.amount) > 0);
      const transactionResults: Array<{ success: boolean; hash?: string; error?: string; recipient: string; amount: string }> = [];

      // Send transactions sequentially to maintain nonce order
      for (let i = 0; i < validRecipients.length; i++) {
        const recipient = validRecipients[i];
        try {
          // Use nonce + 1 for each transaction
          const transactionNonce = currentNonce + 1;

          const transaction = createTransaction(
            wallet.address,
            recipient.address,
            Number(recipient.amount),
            transactionNonce,
            wallet.privateKey,
            wallet.publicKey || ''
          );

          const result = await sendTransaction(transaction);
          
          transactionResults.push({
            ...result,
            recipient: recipient.address,
            amount: recipient.amount
          });

          if (result.success) {
            // Update local nonce immediately after successful send
            currentNonce = transactionNonce;
            setNonce(currentNonce);
          }

          // Small delay between transactions
          if (i < validRecipients.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          transactionResults.push({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            recipient: recipient.address,
            amount: recipient.amount
          });
        }
      }

      setResults(transactionResults);

      const successCount = transactionResults.filter(r => r.success).length;
      if (successCount > 0) {
        toast({
          title: "Transactions Sent!",
          description: `${successCount} out of ${transactionResults.length} transactions sent successfully`,
        });

        // Reset form if all successful
        if (successCount === transactionResults.length) {
          setRecipients([{ address: '', amount: '' }]);
        }

        // Update balance after successful transactions
        // Wait a bit for the balance to potentially update on the server
        setTimeout(async () => {
          try {
            const updatedBalance = await fetchBalance(wallet.address);
            onBalanceUpdate(updatedBalance.balance);
            // Update nonce from server response as well
            setNonce(updatedBalance.nonce);
          } catch (error) {
            console.error('Failed to refresh balance after transaction:', error);
          }
        }, 2000);
        
        // Notify parent component about successful transaction
        onTransactionSuccess();
      }
    } catch (error) {
      console.error('Multi-send error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send transactions",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  if (!wallet) {
    return (
      <Alert>
        <div className="flex items-start space-x-3">
          <WalletIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <AlertDescription>
            No wallet available. Please generate or import a wallet first.
          </AlertDescription>
        </div>
      </Alert>
    );
  }

  const totalAmount = getTotalAmount();
  const currentBalance = balance || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Multi Send
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <AlertDescription>
              Multi-send will create separate transactions for each recipient. 
              Make sure you have sufficient balance to cover all amounts.
            </AlertDescription>
          </div>
        </Alert>

        {/* Wallet Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>From Address</Label>
            <div className="p-3 bg-muted rounded-md font-mono text-sm break-all">
              {wallet.address}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Current Balance</Label>
            <div className="p-3 bg-muted rounded-md font-mono text-sm">
              {currentBalance.toFixed(8)} OCT
            </div>
          </div>
        </div>

        {/* Recipients */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Recipients</Label>
            <Badge variant="secondary">
              {recipients.length} recipient{recipients.length !== 1 ? 's' : ''}
            </Badge>
          </div>

          {recipients.map((recipient, index) => (
            <Card key={index} className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Recipient {index + 1}</span>
                  {recipients.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRecipient(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor={`address-${index}`}>Address</Label>
                    <Input
                      id={`address-${index}`}
                      placeholder="Recipient address (oct...)"
                      value={recipient.address}
                      onChange={(e) => updateRecipient(index, 'address', e.target.value)}
                      className="font-mono"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`amount-${index}`}>Amount (OCT)</Label>
                    <Input
                      id={`amount-${index}`}
                      type="number"
                      placeholder="0.00000000"
                      value={recipient.amount}
                      onChange={(e) => updateRecipient(index, 'amount', e.target.value)}
                      step="0.00000001"
                      min="0"
                    />
                  </div>
                </div>
              </div>
            </Card>
          ))}

          <Button
            variant="outline"
            onClick={addRecipient}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Recipient
          </Button>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-3">
            <Label className="text-base font-medium">Transaction Results</Label>
            {results.map((result, index) => (
              <div
                key={index}
                className={`rounded-lg p-4 ${result.success ? 'bg-green-50 border border-green-200 dark:bg-green-950/50 dark:border-green-800' : 'bg-red-50 border border-red-200 dark:bg-red-950/50 dark:border-red-800'}`}
              >
                <div className="flex items-start">
                  {result.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mr-2 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${result.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                      {result.success ? 'Success' : 'Failed'} - {result.recipient} ({result.amount} OCT)
                    </p>
                    {result.success && result.hash && (
                      <div className="mt-2">
                        <p className="text-green-700 dark:text-green-300 text-sm">Transaction Hash:</p>
                        <div className="flex items-center mt-1">
                          <code className="text-xs bg-green-100 dark:bg-green-900/50 px-2 py-1 rounded font-mono break-all text-green-800 dark:text-green-200">
                            {result.hash}
                          </code>
                          <a
                            href={`https://octrascan.io/tx/${result.hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                            title="View on OctraScan"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                      </div>
                    )}
                    {result.error && (
                      <p className="text-red-700 dark:text-red-300 text-sm mt-1">{result.error}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Separator />

        {/* Summary */}
        <div className="p-4 bg-muted rounded-md space-y-2">
          <div className="text-sm font-medium mb-2">Transaction Summary</div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Total Recipients:</span>
              <span>{recipients.filter(r => r.address && Number(r.amount) > 0).length}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Amount:</span>
              <span className="font-mono">{totalAmount.toFixed(8)} OCT</span>
            </div>
            <div className="flex justify-between">
              <span>Current Balance:</span>
              <span className="font-mono">{currentBalance.toFixed(8)} OCT</span>
            </div>
            <div className="flex justify-between">
              <span>Current Nonce:</span>
              <span className="font-mono">{nonce}</span>
            </div>
            <div className="flex justify-between">
              <span>Next Nonce:</span>
              <span className="font-mono">{nonce + recipients.filter(r => r.address && Number(r.amount) > 0).length}</span>
            </div>
            {totalAmount > currentBalance && (
              <div className="text-red-600 text-xs mt-2">
                ⚠️ Insufficient balance for this transaction
              </div>
            )}
          </div>
        </div>

        <Button 
          onClick={handleSendMultiple}
          disabled={isSending || !validateRecipients() || totalAmount > currentBalance}
          className="w-full"
          size="lg"
        >
          {isSending ? "Sending..." : `Send to ${recipients.filter(r => r.address && Number(r.amount) > 0).length} Recipients`}
        </Button>
      </CardContent>
    </Card>
  );
}