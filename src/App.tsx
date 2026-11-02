import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { useAuth } from './lib/auth';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Labels from './pages/Labels';
import Home from './pages/Home';
import Outstanding from './pages/Outstanding';
import Checkout from './pages/Checkout';
import Items from './pages/Items';
import ItemDetail from './pages/ItemDetail';
import Collections from './pages/Collections';
import LowStock from './pages/LowStock';
import Approvals from './pages/Approvals';
import Counts from './pages/Counts';
import CountDetail from './pages/CountDetail';
import SyncProblems from './pages/SyncProblems';
import Holders from './pages/Holders';
import Team from './pages/Team';
import SettingsPage from './pages/Settings';
import Reports from './pages/Reports';
import AnnouncementsAdmin from './pages/AnnouncementsAdmin';
import Imports from './pages/Imports';
import NotificationSettings from './pages/NotificationSettings';
import Jobs from './pages/Jobs';
import StoreLayout from './pages/StoreLayout';
import ActivityPage from './pages/Activity';

export default function App() {
  const { me, can, booting } = useAuth();
  if (booting) return <div className="login" aria-busy="true"><div className="skel" style={{ width: 240, height: 24 }} /></div>;
  if (!me) return <Routes><Route path="/signup" element={<Signup />} /><Route path="*" element={<Login />} /></Routes>;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="outstanding" element={<Outstanding />} />
        <Route path="checkout" element={can('store_staff') ? <Checkout /> : <Navigate to="/" />} />
        <Route path="items" element={<Items />} />
        <Route path="items/:id" element={<ItemDetail />} />
        <Route path="collections" element={<Collections />} />
        <Route path="labels" element={can('store_staff') ? <Labels /> : <Navigate to="/" />} />
        <Route path="low-stock" element={<LowStock />} />
        <Route path="counts" element={can('supervisor') ? <Counts /> : <Navigate to="/" />} />
        <Route path="counts/:id" element={can('supervisor') ? <CountDetail /> : <Navigate to="/" />} />
        <Route path="sync" element={can('supervisor') ? <SyncProblems /> : <Navigate to="/" />} />
        <Route path="people" element={<Holders />} />
        <Route path="team" element={can('supervisor') ? <Team /> : <Navigate to="/" />} />
        <Route path="settings" element={can('admin') ? <SettingsPage /> : <Navigate to="/" />} />
        <Route path="reports" element={can('supervisor') ? <Reports /> : <Navigate to="/" />} />
        <Route path="announcements" element={can('admin') ? <AnnouncementsAdmin /> : <Navigate to="/" />} />
        <Route path="imports" element={can('admin') ? <Imports /> : <Navigate to="/" />} />
        <Route path="notifications" element={<NotificationSettings />} />
        <Route path="jobs" element={<Jobs />} />
        <Route path="layout" element={can('admin') ? <StoreLayout /> : <Navigate to="/" />} />
        <Route path="approvals" element={can('supervisor') ? <Approvals /> : <Navigate to="/" />} />
        <Route path="activity" element={can('supervisor') ? <ActivityPage /> : <Navigate to="/" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Route>
    </Routes>
  );
}
