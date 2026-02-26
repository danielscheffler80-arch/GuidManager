import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface TableRecord {
    id: number;
    [key: string]: any;
}

const DatabaseExplorer: React.FC = () => {
    const { backendUrl, user } = useAuth();
    const [tables, setTables] = useState<string[]>([]);
    const [selectedTable, setSelectedTable] = useState<string>('');
    const [records, setRecords] = useState<TableRecord[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit] = useState(25);
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editData, setEditData] = useState<any>({});
    const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

    const isSuperuser = String(user?.battlenetId) === '100379014';

    useEffect(() => {
        if (!isSuperuser) return;
        fetchTables();
    }, [isSuperuser]);

    useEffect(() => {
        if (selectedTable) {
            fetchRecords();
        }
    }, [selectedTable, page]);

    const fetchTables = async () => {
        try {
            const res = await fetch(`${backendUrl}/api/admin/tables`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
            });
            const data = await res.json();
            if (data.success) {
                setTables(data.tables);
                if (data.tables.length > 0) setSelectedTable(data.tables[0]);
            } else {
                setStatus({ type: 'error', msg: data.error || 'Failed to fetch tables' });
            }
        } catch (e: any) {
            console.error('Failed to fetch tables', e);
            setStatus({ type: 'error', msg: e.message });
        }
    };

    const fetchRecords = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${backendUrl}/api/admin/tables/${selectedTable}?page=${page}&limit=${limit}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
            });
            const data = await res.json();
            if (data.success) {
                setRecords(data.records);
                setTotal(data.total);
            } else {
                setStatus({ type: 'error', msg: data.error || 'Failed to fetch records' });
            }
        } catch (e: any) {
            console.error('Failed to fetch records', e);
            setStatus({ type: 'error', msg: e.message });
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async (id: number) => {
        try {
            const res = await fetch(`${backendUrl}/api/admin/tables/${selectedTable}/${id}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(editData)
            });
            const data = await res.json();
            if (data.success) {
                setStatus({ type: 'success', msg: 'Eintrag aktualisiert!' });
                setEditingId(null);
                fetchRecords();
            } else {
                setStatus({ type: 'error', msg: data.error });
            }
        } catch (e: any) {
            setStatus({ type: 'error', msg: e.message });
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Eintrag wirklich löschen? Dies kann nicht rückgängig gemacht werden.')) return;
        try {
            const res = await fetch(`${backendUrl}/api/admin/tables/${selectedTable}/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
            });
            const data = await res.json();
            if (data.success) {
                setStatus({ type: 'success', msg: 'Eintrag gelöscht!' });
                fetchRecords();
            }
        } catch (e: any) {
            setStatus({ type: 'error', msg: e.message });
        }
    };

    const startEditing = (record: TableRecord) => {
        setEditingId(record.id);
        setEditData({ ...record });
    };

    if (!isSuperuser) {
        return <div style={{ color: '#ef4444', textAlign: 'center', padding: '100px', fontWeight: 'bold' }}>Zugriff verweigert. Nur für Superuser.</div>;
    }

    // Dynamic Columns based on records
    const columns = records.length > 0 ? Object.keys(records[0]) : [];

    return (
        <div style={containerStyle}>
            <header style={headerStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <h1 style={titleStyle}>☁️ Cloud Database Explorer</h1>
                    <select
                        value={selectedTable}
                        onChange={(e) => { setSelectedTable(e.target.value); setPage(1); }}
                        style={selectStyle}
                    >
                        {tables.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#888' }}>
                    Total Records: {total} | Backend: {backendUrl}
                </div>
            </header>

            {status && (
                <div style={{ ...statusToast, backgroundColor: status.type === 'success' ? '#10b981' : '#ef4444' }}>
                    {status.msg}
                    <button onClick={() => setStatus(null)} style={{ background: 'none', border: 'none', color: 'white', marginLeft: '10px', cursor: 'pointer' }}>✕</button>
                </div>
            )}

            <div style={contentStyle}>
                {loading ? (
                    <div style={loadingOverlay}>Lädt Daten...</div>
                ) : (
                    <div style={tableWrapper}>
                        <table style={tableStyle}>
                            <thead>
                                <tr>
                                    {columns.map((col: string) => <th key={col} style={thStyle}>{col}</th>)}
                                    <th style={thStyle}>Aktionen</th>
                                </tr>
                            </thead>
                            <tbody>
                                {records.map(record => (
                                    <tr key={record.id} style={trStyle}>
                                        {columns.map((col: string) => (
                                            <td key={col} style={tdStyle}>
                                                {editingId === record.id ? (
                                                    col === 'id' || col === 'createdAt' || col === 'updatedAt' ? (
                                                        <span style={{ color: '#666' }}>{String(record[col])}</span>
                                                    ) : (
                                                        <input
                                                            value={typeof editData[col] === 'object' ? JSON.stringify(editData[col]) : editData[col]}
                                                            onChange={(e) => setEditData({ ...editData, [col]: e.target.value })}
                                                            style={inputStyle}
                                                        />
                                                    )
                                                ) : (
                                                    <span title={JSON.stringify(record[col])}>
                                                        {typeof record[col] === 'object' ? '{...}' : String(record[col])}
                                                    </span>
                                                )}
                                            </td>
                                        ))}
                                        <td style={tdStyle}>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                {editingId === record.id ? (
                                                    <>
                                                        <button onClick={() => handleUpdate(record.id)} style={saveBtn}>Save</button>
                                                        <button onClick={() => setEditingId(null)} style={cancelBtn}>Cancel</button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button onClick={() => startEditing(record)} style={editBtn}>Edit</button>
                                                        <button onClick={() => handleDelete(record.id)} style={deleteBtn}>Delete</button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div style={paginationStyle}>
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={pageBtn}>Vorherige</button>
                <span style={{ margin: '0 20px', fontWeight: 'bold' }}>Seite {page} von {Math.ceil(total / limit)}</span>
                <button disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(p => p + 1)} style={pageBtn}>Nächste</button>
            </div>
        </div>
    );
};

// Styles
const containerStyle: React.CSSProperties = { height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#141414', color: '#D1D9E0', fontFamily: 'Inter, sans-serif' };
const headerStyle: React.CSSProperties = { padding: '20px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1a1a1a' };
const titleStyle: React.CSSProperties = { margin: 0, fontSize: '1.2rem', fontWeight: 'bold' };
const selectStyle: React.CSSProperties = { backgroundColor: '#333', color: 'white', border: '1px solid #444', padding: '8px 15px', borderRadius: '8px', outline: 'none' };
const contentStyle: React.CSSProperties = { flex: 1, overflow: 'hidden', position: 'relative' };
const tableWrapper: React.CSSProperties = { overflow: 'auto', height: '100%', padding: '10px' };
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' };
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '12px 10px', backgroundColor: '#252525', borderBottom: '2px solid #333', position: 'sticky', top: 0, zIndex: 10 };
const tdStyle: React.CSSProperties = { padding: '10px', borderBottom: '1px solid #222', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const trStyle: React.CSSProperties = { transition: 'background 0.2s', ':hover': { backgroundColor: '#1e1e1e' } } as any;
const inputStyle: React.CSSProperties = { backgroundColor: '#000', color: '#10b981', border: '1px solid #444', borderRadius: '4px', padding: '4px 8px', width: '100%', outline: 'none' };
const paginationStyle: React.CSSProperties = { padding: '15px', borderTop: '1px solid #333', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a' };

const pageBtn: React.CSSProperties = { padding: '8px 20px', backgroundColor: '#252525', border: '1px solid #444', color: 'white', borderRadius: '8px', cursor: 'pointer', opacity: 1 };
const editBtn: React.CSSProperties = { padding: '4px 8px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' };
const deleteBtn: React.CSSProperties = { padding: '4px 8px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' };
const saveBtn: React.CSSProperties = { padding: '4px 8px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' };
const cancelBtn: React.CSSProperties = { padding: '4px 8px', backgroundColor: '#666', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' };

const statusToast: React.CSSProperties = { position: 'fixed', bottom: '80px', right: '20px', padding: '15px 25px', borderRadius: '12px', color: 'white', fontWeight: 'bold', zIndex: 1000, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' };
const loadingOverlay: React.CSSProperties = { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, fontSize: '1.2rem', fontWeight: 'bold' };

export default DatabaseExplorer;
