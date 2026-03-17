import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Backtester from './pages/Backtester'
import Rules from './pages/Rules'
import Trades from './pages/Trades'
import Analytics from './pages/Analytics'
import Scanner from './pages/Scanner'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/scanner" element={<Scanner />} />
        <Route path="/backtester" element={<Backtester />} />
        <Route path="/rules" element={<Rules />} />
        <Route path="/trades" element={<Trades />} />
        <Route path="/analytics" element={<Analytics />} />
      </Route>
    </Routes>
  )
}
