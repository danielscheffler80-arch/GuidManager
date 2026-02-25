import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const BottomBar: React.FC = () => {
    const { user } = useAuth();

    const handleReportBug = () => {
        // Placeholder for bug reporting - e.g. open a form or mailto
        window.open('https://github.com/danielscheffler80-arch/GuidManager/issues/new?labels=bug', '_blank');
    };

    const handleFeedback = () => {
        // Placeholder for feedback
        window.open('https://github.com/danielscheffler80-arch/GuidManager/discussions/new?category=ideas', '_blank');
    };

    return (
        <div className="bottom-bar">
            <div className="bottom-bar-left">
                <span className="version-info">Guild Manager v0.9.33</span>
                <span className="user-info">Eingeloggt als: {user?.battletag}</span>
            </div>
            <div className="bottom-bar-actions">
                <button className="feedback-btn bug" onClick={handleReportBug}>
                    <span className="icon">🐛</span> Bug melden
                </button>
                <button className="feedback-btn feedback" onClick={handleFeedback}>
                    <span className="icon">💡</span> Feedback geben
                </button>
            </div>
        </div>
    );
};

export default BottomBar;
