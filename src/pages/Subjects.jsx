import React, { useState } from 'react';
import { Plus, Search, Edit2, Trash2 } from 'lucide-react';
import Modal from '../components/Modal';
import { useData } from '../context/DataContext';
import DataImporter from '../components/DataImporter';

const Subjects = () => {
    const { subjects, addSubject, updateSubject, deleteSubject, clearSubjects } = useData();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentSubject, setCurrentSubject] = useState({
        id: null,
        name: '',
        code: '',
        semester: '',
        type: 'Lecture',
        credits: '',
        alternatives: []
    });
    const [isEditing, setIsEditing] = useState(false);

    const openAddModal = () => {
        setIsEditing(false);
        setCurrentSubject({ id: null, name: '', code: '', semester: '', type: 'Lecture', credits: '', alternatives: [] });
        setIsModalOpen(true);
    };

    const handleEdit = (subject) => {
        setIsEditing(true);
        setCurrentSubject(subject);
        setIsModalOpen(true);
    };

    const handleDelete = (id) => {
        deleteSubject(id);
    };

    const handleClearAll = () => {
        if (window.confirm('Are you sure you want to delete ALL subjects? This action cannot be undone.')) {
            clearSubjects();
        }
    };

    const handleSaveSubject = () => {
        if (isEditing) {
            updateSubject(currentSubject);
        } else {
            addSubject(currentSubject);
        }
        setIsModalOpen(false);
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>Subjects</h1>
                    <p style={{ color: 'var(--text-light)' }}>View and manage course catalog.</p>
                </div>
                <div className="input-group">
                    <button
                        className="btn btn-outline"
                        onClick={handleClearAll}
                        style={{ color: 'var(--danger)', borderColor: 'var(--danger)', marginRight: '0.5rem' }}
                    >
                        <Trash2 size={18} style={{ marginRight: '0.5rem' }} />
                        Clear All
                    </button>
                    <div style={{ position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                        <input type="text" placeholder="Search subjects..." className="input-field" style={{ paddingLeft: '36px' }} />
                    </div>
                    <button className="btn btn-primary" onClick={openAddModal}>
                        <Plus size={18} style={{ marginRight: '0.5rem' }} />
                        Add Subject
                    </button>
                </div>
            </div>

            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Sem</th>
                            <th>Code</th>
                            <th>Subject Name</th>
                            <th>Type</th>
                            <th>Credits</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {subjects.length === 0 ? (
                            <tr>
                                <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>
                                    No subjects found. Add one to get started.
                                </td>
                            </tr>
                        ) : (
                            subjects.map((subject) => (
                                <tr key={subject.id}>
                                    <td>
                                        <span className="badge badge-outline">{subject.semester || '-'}</span>
                                    </td>
                                    <td>
                                        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{subject.code}</span>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 500 }}>{subject.name}</div>
                                    </td>
                                    <td>
                                        <span className={`badge ${subject.type === 'Lab' ? 'badge-warning' : 'badge-success'}`}>
                                            {subject.type}
                                        </span>
                                    </td>
                                    <td>{subject.credits}</td>
                                    <td style={{ textAlign: 'right' }}>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                            <button className="btn btn-outline" style={{ padding: '6px' }} onClick={() => handleEdit(subject)}>
                                                <Edit2 size={16} />
                                            </button>
                                            <button className="btn btn-outline" style={{ padding: '6px', color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => handleDelete(subject.id)}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={isEditing ? "Edit Subject" : "Add New Subject"}
                footer={
                    <>
                        <button className="btn btn-outline" onClick={() => setIsModalOpen(false)}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSaveSubject}>{isEditing ? "Save Changes" : "Add Subject"}</button>
                    </>
                }
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="form-group">
                        <label className="form-label">Subject Name</label>
                        <input
                            type="text"
                            className="input-field w-full"
                            placeholder="e.g. Data Structures"
                            value={currentSubject.name}
                            onChange={(e) => setCurrentSubject({ ...currentSubject, name: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Subject Code</label>
                        <input
                            type="text"
                            className="input-field w-full"
                            placeholder="e.g. CS201"
                            value={currentSubject.code}
                            onChange={(e) => setCurrentSubject({ ...currentSubject, code: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Semester</label>
                        <select
                            className="form-select"
                            value={currentSubject.semester}
                            onChange={(e) => setCurrentSubject({ ...currentSubject, semester: e.target.value })}
                        >
                            <option value="">Select Semester</option>
                            <option value="I">I</option>
                            <option value="II">II</option>
                            <option value="III">III</option>
                            <option value="IV">IV</option>
                            <option value="V">V</option>
                            <option value="VI">VI</option>
                            <option value="VII">VII</option>
                            <option value="VIII">VIII</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Type</label>
                        <select
                            className="form-select"
                            value={currentSubject.type}
                            onChange={(e) => setCurrentSubject({ ...currentSubject, type: e.target.value })}
                        >
                            <option value="Lecture">Lecture</option>
                            <option value="Lab">Lab</option>
                            <option value="Seminar">Seminar</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Credit Hours</label>
                        <input
                            type="number"
                            className="input-field w-full"
                            placeholder="e.g. 3"
                            value={currentSubject.credits}
                            onChange={(e) => setCurrentSubject({ ...currentSubject, credits: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label className="form-label">Alternative Names / Group</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '0.8rem' }}>Count:</span>
                                <input
                                    type="number"
                                    min="0"
                                    max="5"
                                    value={currentSubject.alternatives.length}
                                    onChange={(e) => {
                                        const count = parseInt(e.target.value) || 0;
                                        const newAlts = [...currentSubject.alternatives];
                                        if (count > newAlts.length) {
                                            for (let i = newAlts.length; i < count; i++) {
                                                newAlts.push({ code: '', name: '' });
                                            }
                                        } else {
                                            newAlts.length = Math.max(0, count);
                                        }
                                        setCurrentSubject({ ...currentSubject, alternatives: newAlts });
                                    }}
                                    style={{ width: '50px', padding: '2px 4px', borderRadius: '4px', border: '1px solid #ddd' }}
                                />
                            </div>
                        </div>
                        {currentSubject.alternatives.map((alt, idx) => (
                            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="Code"
                                    value={alt.code}
                                    onChange={(e) => {
                                        const newAlts = [...currentSubject.alternatives];
                                        newAlts[idx] = { ...newAlts[idx], code: e.target.value };
                                        setCurrentSubject({ ...currentSubject, alternatives: newAlts });
                                    }}
                                />
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder={`Subject Name ${idx + 1}`}
                                    value={alt.name}
                                    onChange={(e) => {
                                        const newAlts = [...currentSubject.alternatives];
                                        newAlts[idx] = { ...newAlts[idx], name: e.target.value };
                                        setCurrentSubject({ ...currentSubject, alternatives: newAlts });
                                    }}
                                />
                            </div>
                        ))}
                        {currentSubject.alternatives.length === 0 && (
                            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>No alternatives defined. Set count above to add.</p>
                        )}
                    </div>
                </div>
            </Modal>
            <DataImporter />
        </div>
    );
};

export default Subjects;
