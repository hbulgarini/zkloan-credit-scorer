import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardActions,
  Typography,
  TextField,
  Button,
  Box,
  Alert,
  CircularProgress,
  Backdrop,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import LinkIcon from '@mui/icons-material/Link';
import { useZKLoanContext } from '../hooks';
import { type ZKLoanDeployment } from '../contexts';

export const LoanRequestForm: React.FC = () => {
  // Note: `deploy` is available but disabled in UI due to Lace wallet v4.x compatibility
  const { deployment$, join, requestLoan } = useZKLoanContext();

  const [deployment, setDeployment] = useState<ZKLoanDeployment>({ status: 'idle' });
  const [contractAddress, setContractAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    const subscription = deployment$.subscribe(setDeployment);
    return () => subscription.unsubscribe();
  }, [deployment$]);

  // Note: Deploy functionality is disabled in UI due to Lace wallet v4.x compatibility issues.
  // Use CLI to deploy contracts, then join them via this UI.
  // const handleDeploy = () => { setResult(null); deploy(); };

  const handleJoin = () => {
    if (!contractAddress.trim()) {
      setResult({ success: false, message: 'Please enter a contract address' });
      return;
    }
    setResult(null);
    join(contractAddress.trim());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!amount || !pin) {
      setResult({ success: false, message: 'Please fill in all fields' });
      return;
    }

    const amountNum = parseInt(amount, 10);
    const pinNum = parseInt(pin, 10);

    if (isNaN(amountNum) || amountNum <= 0) {
      setResult({ success: false, message: 'Amount must be a positive number' });
      return;
    }

    if (isNaN(pinNum) || pin.length < 4 || pin.length > 6) {
      setResult({ success: false, message: 'PIN must be 4-6 digits' });
      return;
    }

    setIsSubmitting(true);
    setResult(null);

    try {
      await requestLoan(BigInt(amountNum), BigInt(pinNum));
      setResult({ success: true, message: 'Loan request submitted successfully!' });
      setAmount('');
      setPin('');
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to submit loan request',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDeployed = deployment.status === 'deployed';
  const isLoading = deployment.status === 'in-progress';
  const hasFailed = deployment.status === 'failed';

  return (
    <Card sx={{ background: '#1a1a2e', color: '#fff' }}>
      <Backdrop
        sx={{ position: 'absolute', color: '#fff', zIndex: 10, borderRadius: 2 }}
        open={isLoading || isSubmitting}
      >
        <CircularProgress color="primary" />
      </Backdrop>

      <CardHeader
        avatar={<SendIcon color="primary" />}
        title="Loan Request"
        subheader={
          isDeployed && deployment.contractAddress
            ? `Contract: ${typeof deployment.contractAddress === 'string'
                ? `${deployment.contractAddress.slice(0, 10)}...${deployment.contractAddress.slice(-8)}`
                : `${Array.from(deployment.contractAddress as Uint8Array).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 10)}...`}`
            : 'Deploy or join a contract to apply'
        }
        subheaderTypographyProps={{ color: 'grey.500' }}
      />

      <CardContent>
        {!isDeployed && (
          <Box sx={{ mb: 3 }}>
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>Limitation:</strong> Lace wallet v4.x does not yet implement <code>getProvingProvider</code>, which is required for browser-based ZK proof generation.
                Contract interactions require proving with <code>embedded-fr</code> binding, but the remote proof server produces <code>pedersen-schnorr</code> binding.
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                <strong>Workaround:</strong> Use CLI to deploy and call contracts. The CLI uses a local proof server with compatible binding.
              </Typography>
            </Alert>

            <Typography variant="body2" color="grey.400" sx={{ mb: 2 }}>
              Join an existing contract or deploy via CLI:
            </Typography>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Contract Address"
                value={contractAddress}
                onChange={(e) => setContractAddress(e.target.value)}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'grey.700' },
                    '&:hover fieldset': { borderColor: 'grey.500' },
                  },
                }}
              />
              <Button
                variant="outlined"
                startIcon={<LinkIcon />}
                onClick={handleJoin}
                disabled={isLoading || !contractAddress.trim()}
              >
                Join
              </Button>
            </Box>
          </Box>
        )}

        {hasFailed && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {deployment.error.message}
          </Alert>
        )}

        {isDeployed && (
          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Loan Amount ($)"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              sx={{
                mb: 2,
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  '& fieldset': { borderColor: 'grey.700' },
                  '&:hover fieldset': { borderColor: 'grey.500' },
                },
                '& .MuiInputLabel-root': { color: 'grey.400' },
              }}
              inputProps={{ min: 1, max: 10000 }}
            />

            <TextField
              fullWidth
              label="Secret PIN (4-6 digits)"
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              sx={{
                mb: 2,
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  '& fieldset': { borderColor: 'grey.700' },
                  '&:hover fieldset': { borderColor: 'grey.500' },
                },
                '& .MuiInputLabel-root': { color: 'grey.400' },
              }}
              inputProps={{ maxLength: 6 }}
            />

            {result && (
              <Alert severity={result.success ? 'success' : 'error'} sx={{ mb: 2 }}>
                {result.message}
              </Alert>
            )}
          </Box>
        )}
      </CardContent>

      {isDeployed && (
        <CardActions sx={{ px: 2, pb: 2 }}>
          <Button
            variant="contained"
            fullWidth
            startIcon={<SendIcon />}
            onClick={handleSubmit}
            disabled={isSubmitting || !amount || !pin}
          >
            Request Loan
          </Button>
        </CardActions>
      )}
    </Card>
  );
};
