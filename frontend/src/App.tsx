import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { DashboardProvider } from './context/DashboardContext';
import { ThemeProvider } from './context/ThemeContext';
import { AppLayout } from './components/layout/AppLayout';
import { OverviewPage } from './pages/OverviewPage';
import { NetworkPage } from './pages/NetworkPage';
import { IncidentsPage } from './pages/IncidentsPage';
import { EventsPage } from './pages/EventsPage';
import { ChannelsPage } from './pages/ChannelsPage';
import { SimulationPage } from './pages/SimulationPage';
import { TechniciansPage } from './pages/TechniciansPage';

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <DashboardProvider>
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route index element={<OverviewPage />} />
              <Route path="network" element={<NetworkPage />} />
              <Route path="incidents" element={<IncidentsPage />} />
              <Route path="incidents/:incidentId" element={<IncidentsPage />} />
              <Route path="technicians" element={<TechniciansPage />} />
              <Route path="events" element={<EventsPage />} />
              <Route path="channels" element={<ChannelsPage />} />
              <Route path="simulation" element={<SimulationPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </DashboardProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
