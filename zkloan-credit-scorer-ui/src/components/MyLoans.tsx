import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardActions,
  Typography,
  Button,
  Box,
  Alert,
  CircularProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useZKLoanContext } from '../hooks';
import { type ZKLoanDeployment, type UserLoan } from '../contexts';

const DEFAULT_PIN = 1234n;

export const MyLoans: React.FC = () => {
  const { deployment$, getMyLoans, flowMessage } = useZKLoanContext();

  const [deployment, setDeployment] = useState<ZKLoanDeployment>({ status: 'idle' });
  const [loans, setLoans] = useState<UserLoan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    const subscription = deployment$.subscribe(setDeployment);
    return () => subscription.unsubscribe();
  }, [deployment$]);

  const isDeployed = deployment.status === 'deployed';

  const handleFetchLoans = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const userLoans = await getMyLoans(DEFAULT_PIN);
      setLoans(userLoans);
      setHasLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch loans');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-fetch when contract becomes deployed
  useEffect(() => {
    if (isDeployed && !hasLoaded) {
      handleFetchLoans();
    }
  }, [isDeployed, hasLoaded]);

  if (!isDeployed) {
    return (
      <Card sx={{ background: '#1a1a2e', color: '#fff' }}>
        <CardHeader
          avatar={<HistoryIcon color="primary" />}
          title="My Loans"
          subheader="Deploy or join a contract to view loans"
          subheaderTypographyProps={{ color: 'grey.500' }}
        />
        <CardContent>
          <Typography variant="body2" color="grey.400">
            Connect to a contract to view your loan history.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ background: '#1a1a2e', color: '#fff', position: 'relative' }}>
      <CardHeader
        avatar={<HistoryIcon color="primary" />}
        title="My Loans"
        subheader="Your loan applications and results"
        subheaderTypographyProps={{ color: 'grey.500' }}
      />

      <CardContent>
        {isLoading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3 }}>
            <CircularProgress color="primary" size={40} />
            {flowMessage && (
              <Typography variant="body2" sx={{ mt: 2, color: 'grey.400' }}>
                {flowMessage}
              </Typography>
            )}
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!isLoading && !error && loans.length === 0 && hasLoaded && (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <Typography variant="body1" color="grey.400">
              No loans found for your account.
            </Typography>
            <Typography variant="body2" color="grey.500" sx={{ mt: 1 }}>
              Submit a loan request to see it here.
            </Typography>
          </Box>
        )}

        {!isLoading && loans.length > 0 && (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: 'grey.400', borderColor: 'grey.800' }}>Loan ID</TableCell>
                  <TableCell sx={{ color: 'grey.400', borderColor: 'grey.800' }}>Amount</TableCell>
                  <TableCell sx={{ color: 'grey.400', borderColor: 'grey.800' }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loans.map((loan) => (
                  <TableRow key={loan.loanId.toString()}>
                    <TableCell sx={{ color: '#fff', borderColor: 'grey.800' }}>
                      #{loan.loanId.toString()}
                    </TableCell>
                    <TableCell sx={{ color: '#fff', borderColor: 'grey.800' }}>
                      ${loan.authorizedAmount.toString()}
                    </TableCell>
                    <TableCell sx={{ borderColor: 'grey.800' }}>
                      <Chip
                        label={loan.status}
                        color={loan.status === 'Approved' ? 'success' : 'error'}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>

      <CardActions sx={{ px: 2, pb: 2 }}>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={handleFetchLoans}
          disabled={isLoading}
          fullWidth
        >
          Refresh Loans
        </Button>
      </CardActions>
    </Card>
  );
};
