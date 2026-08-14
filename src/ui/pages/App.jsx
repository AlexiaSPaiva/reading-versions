import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

import SuiteNav from '../../shared/SuiteNav.jsx';

/**
 * App shell. The screens are added on top of this; what is here is the suite
 * header every later version keeps.
 */
export default function App() {
  return (
    <>
      <SuiteNav
        current="reading"
        title="reading-versions"
        subtitle="Version-control what you understood, and diff it against your past self"
      />

      <Container maxWidth="lg" component="main" className="py-6">
        <Paper className="p-6 text-center">
          <Typography color="text.secondary">Screens are not wired up yet.</Typography>
        </Paper>
      </Container>
    </>
  );
}
