import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import V15 from './v15';
import V14 from './v14';
import NavMenu from './components/NavMenu';

/**
 * Main App component with router setup.
 */
const App = () => {
  return (
    <Router>
      <div style={{ 
        width: '100vw', 
        height: '100vh', 
        background: 'linear-gradient(135deg, #010304, #092025)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <NavMenu />
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <Routes>
            <Route index element={<V14 />} />
            <Route path="/v15" element={<V15 />} />
            {/* Add more routes here as needed */}
          </Routes>
        </div>
      </div>
    </Router>
  );
};

export default App;
