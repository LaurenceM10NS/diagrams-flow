import { Link, useLocation } from 'react-router-dom';

const NavMenu = () => {
  const location = useLocation();
  
  return (
    <div style={{
      background: 'linear-gradient(90deg, #172A2E, #22383C)',
      padding: '12px 20px',
      borderBottom: '1px solid #686F71',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <h1 style={{ color: '#D7D7D7', margin: 0, fontSize: '1.5rem' }}>Penrove</h1>
      
      <div style={{ display: 'flex', gap: '16px' }}>
        <NavLink 
          to="/" 
          label="React Flow v14" 
          isActive={location.pathname === '/'} 
        />
        <NavLink 
          to="/v15" 
          label="React Flow v15" 
          isActive={location.pathname === '/v15'} 
        />
      </div>
    </div>
  );
};

const NavLink = ({ to, label, isActive }: { to: string; label: string; isActive: boolean }) => {
  return (
    <Link 
      to={to} 
      style={{
        color: isActive ? '#D7D7D7' : '#B0C1C6',
        textDecoration: 'none',
        padding: '6px 12px',
        borderRadius: '5px',
        background: isActive ? '#051114' : 'transparent',
        transition: 'all 0.2s ease',
        fontWeight: isActive ? 'bold' : 'normal',
      }}
    >
      {label}
    </Link>
  );
};

export default NavMenu; 