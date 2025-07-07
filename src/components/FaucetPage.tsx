import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Droplets, 
  Shield, 
  CheckCircle, 
  AlertTriangle,
  ExternalLink,
  Copy,
  Clock,
  Users
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

interface ClaimTimer {
  nextClaimTime: number | null;
  timeRemaining: string;
}

export function FaucetPage() {
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [stats, setStats] = useState<FaucetStats>(() => {
    // Load stats from localStorage on component mount
    const savedStats = localStorage.getItem('faucet-stats');
    if (savedStats) {
      try {
        return JSON.parse(savedStats);
      } catch (error) {
        console.error('Failed to parse saved stats:', error);
      }
    }
    return {
      totalClaimed: 0,
      totalUsers: 0,
      lastClaim: null
    };
  });
  const [claimTimer, setClaimTimer] = useState<ClaimTimer>(() => {
    // Load timer from localStorage on component mount
    const savedTimer = localStorage.getItem('faucet-timer');
    if (savedTimer) {
      try {
        const parsed = JSON.parse(savedTimer);
        return {
          nextClaimTime: parsed.nextClaimTime,
          timeRemaining: ''
        };
      } catch (error) {
        console.error('Failed to parse saved timer:', error);
      }
    }
    return {
      nextClaimTime: null,
      timeRemaining: ''
    };
  });
  
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const { toast } = useToast();

  // Use environment variable for reCAPTCHA site key
  const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

  // Timer effect to upd