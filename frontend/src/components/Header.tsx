// Header Component - Slim version without profile (moved to sidebar)

import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const Header: React.FC = () => {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <header className="header slim-header">
      {/* Header ist jetzt leer oder wird für Breadcrumbs/Titel genutzt */}
    </header>
  );
};

export default Header;
