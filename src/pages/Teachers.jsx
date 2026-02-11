import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Search, Filter, Plus, Trash2, Save, FileSpreadsheet, Download } from 'lucide-react';
import Modal from '../components/Modal';
import { useNavigate } from 'react-router-dom';

import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';


const Teachers = () => {
    const { teachers, addTeachers, deleteTeachers, clearTeachers, addFacultyAccounts, facultyAccounts, deleteFacultyAccount } = useData();
    const navigate = useNavigate();
    const fileInputRef = React.useRef(null);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [filterSem, setFilterSem] = useState('All');
    const [isAddOpen, setIsAddOpen] = useState(false);

    const [newTeacher, setNewTeacher] = useState({
        name: '',
        dept: 'CSE'
    });

    const handleAddTeacher = () => {
        if (!newTeacher.name) return;

        const name = newTeacher.name.trim();
        const nameParts = name.split(/\s+/);
        const lastNameRaw = nameParts[nameParts.length - 1];
        let handle = lastNameRaw.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (handle.length < 3) handle = name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 8);

        addFacultyAccounts([{
            id: uuidv4() + '_acc',
            name: name,
            email: `${handle}@psnacet.edu.in`,
            password: handle,
            dept: newTeacher.dept
        }]);
        alert(`Faculty Account Created!\n\nEmail: ${handle}@psnacet.edu.in\nPassword: ${handle}`);
        setIsAddOpen(false);
        setNewTeacher({ name: '', dept: 'CSE' });
    };

    const handleExcelUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setLoading(true);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]]; // Take first sheet

                // Expecting Simple List: Name, Dept
                const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 });

                // Check Header
                const headerRow = jsonData[0] ? jsonData[0].map(h => String(h).toLowerCase().trim()) : [];
                const validHeaders = headerRow.includes('faculty name') || headerRow.includes('name');

                if (!validHeaders) {
                    alert('Invalid Format! Please upload an Excel file with specific columns: "Faculty Name" and "Department".\nUse the Template button to download the correct format.');
                    setLoading(false);
                    e.target.value = null;
                    return;
                }

                const newAccs = [];
                let addedCount = 0;

                // Start from row 1 (skip header)
                for (let i = 1; i < jsonData.length; i++) {
                    const row = jsonData[i];
                    if (!row || row.length === 0) continue;

                    const name = String(row[0] || '').trim();
                    const dept = String(row[1] || 'CSE').trim();

                    if (name.length > 2) {
                        const exists = (facultyAccounts || []).some(acc => acc.name.toLowerCase() === name.toLowerCase());
                        if (!exists) {
                            const nameParts = name.split(/\s+/);
                            const lastNameRaw = nameParts[nameParts.length - 1];
                            let handle = lastNameRaw.toLowerCase().replace(/[^a-z0-9]/g, '');
                            if (handle.length < 3) handle = name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 8);

                            newAccs.push({
                                id: uuidv4() + '_acc',
                                name: name,
                                email: `${handle}@psnacet.edu.in`,
                                password: handle,
                                dept: dept
                            });
                            addedCount++;
                        }
                    }
                }

                if (newAccs.length > 0) {
                    addFacultyAccounts(newAccs);
                    alert(`Success! Created ${addedCount} new faculty accounts.`);
                } else {
                    alert('No new faculty accounts created. They might already exist or the file is empty.');
                }

            } catch (err) {
                console.error(err);
                alert('Error parsing Excel file.');
            } finally {
                setLoading(false);
                e.target.value = null;
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleDownloadTemplate = () => {
        const wb = XLSX.utils.book_new();

        const wsDataF = [
            ["Faculty Name", "Department"],
            ["Dr. John Smith", "CSE"],
            ["Prof. Jane Doe", "IT"],
            ["Mr. Alan Turing", "CSE"]
        ];
        const wsF = XLSX.utils.aoa_to_sheet(wsDataF);
        XLSX.utils.book_append_sheet(wb, wsF, "Faculty_List");

        XLSX.writeFile(wb, "Faculty_Upload_Template.xlsx");
    };

    const displayData = React.useMemo(() => {
        const allocatedNames = new Set(teachers.map(t => t.name.toLowerCase()));
        const allocations = teachers.map(t => ({ ...t, type: 'allocation' }));

        const unallocated = (facultyAccounts || [])
            .filter(acc => !allocatedNames.has(acc.name.toLowerCase()))
            .map(acc => ({
                id: acc.id,
                name: acc.name,
                dept: acc.dept,
                semester: '-',
                subjectCode: '-',
                subjectName: 'Not Assigned',
                section: '-',
                type: 'account'
            }));

        return [...allocations, ...unallocated];
    }, [teachers, facultyAccounts]);

    const filtered = displayData.filter(t => {
        const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
            (t.subjectName && t.subjectName.toLowerCase().includes(search.toLowerCase()));
        const matchesSem = filterSem === 'All' || t.semester === filterSem || (t.semester === '-' && filterSem === 'All');
        return matchesSearch && matchesSem;
    });
    const uniqueSems = Array.from(new Set(teachers.map(t => t.semester).filter(Boolean))).sort();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = React.useRef(null);

    React.useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Teachers</h1>
                    <p style={{ color: 'var(--text-light)' }}>Faculty allocations and details</p>
                </div>
                <div>
                    <button className="btn btn-danger" onClick={() => {
                        if (window.confirm('Are you sure you want to delete ALL teacher allocations? This cannot be undone.')) clearTeachers();
                        if (window.confirm('Are you sure you want to delete ALL teacher allocations? This cannot be undone.')) clearTeachers();
                    }} style={{ color: 'white', marginRight: '1rem' }}>
                        <Trash2 size={18} /> Delete All
                    </button>
                    <button className="btn btn-outline" onClick={handleDownloadTemplate} style={{ marginRight: '1rem', background: 'white', color: '#0f172a', border: '1px solid #e2e8f0' }}>
                        <Download size={18} /> Template
                    </button>
                    <button className="btn btn-outline" onClick={() => fileInputRef.current?.click()} style={{ marginRight: '1rem', background: 'white', color: '#0f172a', border: '1px solid #e2e8f0' }} disabled={loading}>
                        <FileSpreadsheet size={18} /> {loading ? 'Importing...' : 'Import Excel'}
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleExcelUpload}
                        accept=".xlsx,.xls"
                        style={{ display: 'none' }}
                    />
                    <button className="btn btn-primary" onClick={() => setIsAddOpen(true)}>
                        <Plus size={18} /> Add Teacher
                    </button>
                </div>
            </div>
            <div className="card" style={{ padding: '0', display: 'flex', flexDirection: 'column' }}>
                <div className="filter-bar" ref={dropdownRef}>
                    <div className="search-wrapper">
                        <Search size={18} />
                        <input
                            className="elegant-input"
                            placeholder="Search faculty by name or subject..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="filter-group">
                        <Filter size={18} color="#94a3b8" />

                        <div className="custom-select-container">
                            <div
                                className={`custom-select-trigger ${isDropdownOpen ? 'active' : ''}`}
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            >
                                <span>{filterSem === 'All' ? 'All Semesters' : `Sem ${filterSem}`}</span>
                                <Search size={14} style={{ transform: isDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s', opacity: 0.5 }} />
                            </div>
                            {isDropdownOpen && (
                                <div className="custom-select-menu">
                                    <div className={`custom-select-item ${filterSem === 'All' ? 'selected' : ''}`} onClick={() => { setFilterSem('All'); setIsDropdownOpen(false); }}>All Semesters</div>
                                    {uniqueSems.map(s => (
                                        <div key={s} className={`custom-select-item ${filterSem === s ? 'selected' : ''}`} onClick={() => { setFilterSem(s); setIsDropdownOpen(false); }}>Sem {s}</div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Department</th>
                                <th>Semester</th>
                                <th>Subject</th>
                                <th>Section</th>
                                <th style={{ textAlign: 'right' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((t, idx) => (
                                <tr key={t.id || idx}>
                                    <td style={{ fontWeight: '500' }}>{t.name}</td>
                                    <td><span className="badge badge-info">{t.dept || 'General'}</span></td>
                                    <td>Sem {t.semester}</td>
                                    <td>
                                        <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>{t.subjectCode}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>{t.subjectName}</div>
                                    </td>
                                    <td><span className="badge badge-outline">Section {t.section}</span></td>
                                    <td style={{ textAlign: 'right' }}>
                                        <button
                                            className="btn-outline"
                                            style={{ border: 'none', color: 'var(--danger)', padding: '4px', cursor: 'pointer' }}
                                            onClick={() => {
                                                const msg = t.type === 'account'
                                                    ? 'Delete this faculty account? They will be removed from the system.'
                                                    : 'Delete this allocation? The faculty account will remain.';

                                                if (window.confirm(msg)) {
                                                    if (t.type === 'account') deleteFacultyAccount(t.id);
                                                    else deleteTeachers(t.id);
                                                }
                                            }}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>No records found.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
            <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add Teacher Allocation">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Faculty Name</label>
                        <input className="input-field" style={{ width: '100%' }} value={newTeacher.name} onChange={e => setNewTeacher({ ...newTeacher, name: e.target.value })} placeholder="e.g. Dr. A. Smith" />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Department</label>
                        <input className="input-field" style={{ width: '100%' }} value={newTeacher.dept} onChange={e => setNewTeacher({ ...newTeacher, dept: e.target.value })} placeholder="e.g. CSE" />
                    </div>
                    <button className="btn btn-primary" onClick={handleAddTeacher} style={{ marginTop: '0.5rem' }}>
                        <Save size={18} style={{ marginRight: 8 }} /> Save Allocation
                    </button>
                </div>
            </Modal>
        </div>
    );
};
export default Teachers;