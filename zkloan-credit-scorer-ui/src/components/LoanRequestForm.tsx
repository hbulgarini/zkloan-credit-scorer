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
  const { deployment$, join, requestLoan, flowMessage, secretPin } = useZKLoanContext();

  const [deployment, setDeployment] = useState<ZKLoanDeployment>({ status: 'idle' });
  const [contractAddress, setContractAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    const subscription = deployment$.subscribe(setDeployment);
    return () => subscription.unsubscribe();
  }, [deployment$]);

  const handleJoin = () => {
    if (!contractAddress.trim()) {
      setResult({ success: false, message: 'Please enter a contract address' });
      return;
    }
    setResult(null);
    join(contractAddress.trim());
  };

  const isPinValid = secretPin.length >= 4 && secretPin.length <= 6;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!amount) {
      setResult({ success: false, message: 'Please enter a loan amount' });
      return;
    }

    if (!isPinValid) {
      setResult({ success: false, message: 'Please enter a valid PIN (4-6 digits) in the Private State section above' });
      return;
    }

    const amountNum = parseInt(amount, 10);

    if (isNaN(amountNum) || amountNum <= 0) {
      setResult({ success: false, message: 'Amount must be a positive number' });
      return;
    }

    setIsSubmitting(true);
    setResult(null);

    try {
      await requestLoan(BigInt(amountNum));
      setResult({ success: true, message: 'Loan request submitted successfully!' });
      setAmount('');
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
        sx={{ position: 'absolute', color: '#fff', zIndex: 10, borderRadius: 2, flexDirection: 'column', gap: 2 }}
        open={isLoading || isSubmitting}
      >
        <CircularProgress color="primary" />
        {flowMessage && (
          <Typography variant="body2" sx={{ mt: 2, textAlign: 'center', px: 2 }}>
            {flowMessage}
          </Typography>
        )}
      </Backdrop>

      <CardHeader
        avatar={<SendIcon color="primary" />}
        title="Loan Request"
        subheader={
          isDeployed && deployment.contractAddress
            ? `Contract: ${typeof deployment.contractAddress === 'string'
                ? `${deployment.contractAddress.slice(0, 10)}...${deployment.contractAddress.slice(-8)}`
                : `${Array.from(deployment.contractAddress as Uint8Array).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 10)}...`}`
            : 'Join a contract to apply'
        }
        subheaderTypographyProps={{ color: 'grey.500' }}
      />

      <CardContent>
        {!isDeployed && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" color="grey.400" sx={{ mb: 2 }}>
              Enter a contract address to connect:
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
                variant="contained"
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

        {result && (
          <Alert severity={result.success ? 'success' : 'error'} sx={{ mb: 2 }}>
            {result.message}
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
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  '& fieldset': { borderColor: 'grey.700' },
                  '&:hover fieldset': { borderColor: 'grey.500' },
                },
                '& .MuiInputLabel-root': { color: 'grey.400' },
              }}
              inputProps={{ min: 1, max: 10000 }}
            />
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
            disabled={isSubmitting || !amount || !isPinValid}
          >
            Request Loan
          </Button>
        </CardActions>
      )}
    </Card>
  );
};
