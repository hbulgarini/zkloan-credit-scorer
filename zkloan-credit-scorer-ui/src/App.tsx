import React from 'react';
import { Box, Stack, Typography, Link } from '@mui/material';
import { MainLayout, PrivateStateCard, LoanRequestForm, MyLoans } from './components';

const App: React.FC = () => {
  return (
    <MainLayout>
      <Typography variant="h4" component="h1" sx={{ mb: 1 }}>
        Privacy-Preserving Credit Scoring
      </Typography>
      <Typography variant="body1" color="grey.400" sx={{ mb: 4 }}>
        Apply for a loan using zero-knowledge proofs. Your financial data stays private.
      </Typography>

      <Stack spacing={3}>
        <PrivateStateCard />
        <LoanRequestForm />
        <MyLoans />
      </Stack>

      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="grey.600">
          Built on{' '}
          <Link href="https://midnight.network" target="_blank" rel="noopener" color="primary">
            Midnight
          </Link>
          . Private by design.
        </Typography>
      </Box>
    </MainLayout>
  );
};

export default App;
