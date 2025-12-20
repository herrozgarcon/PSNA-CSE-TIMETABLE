import React, { useState } from 'react';
import { Plus, Search, Edit2, Trash2 } from 'lucide-react';
import Modal from '../components/Modal';
import { useData } from '../context/DataContext';
import DataImporter from '../components/DataImporter';

const Teachers = () => {
    const { teachers, subjects, addTeacher, updateTeacher, deleteTeacher, clearTeachers } = useData();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentTeacher, setCurrentTeacher] = useState({
        id: null,
        name: '',
        department: '',
        subject: '',
        assignedClass: '',
        semester: '',
        email: '',
        phone: ''
    });
    const [isEditing, setIsEditing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterSem, setFilterSem] = useState('All');
    const [filterSec, setFilterSec] = useState('All');

    const filteredTeachers = (teachers || []).filter(t => {
        const matchesSearch = (t.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.subject?.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesSem = filterSem === 'All' || t.semester === filterSem;
        const matchesSec = filterSec === 'All' || t.assignedClass?.includes(filterSec);
        return matchesSearch && matchesSem && matchesSec;
    });

    const openAddModal = () => {
        setIsEditing(false);
        setCurrentTeacher({ id: null, name: '', department: '', subject: '', semester: '', assignedClass: '', email: '', phone: '' });
        setIsModalOpen(true);
    };

    const handleEdit = (teacher) => {
        setIsEditing(true);
        setCurrentTeacher(teacher);
        setIsModalOpen(true);
    };

    const handleDelete = (id) => {
        // Removed confirmation alert as per request
        deleteTeacher(id);
    };

    const handleClearAll = () => {
        if (window.confirm('WARNING: This will delete ALL teachers. This action cannot be undone. Are you sure?')) {
            clearTeachers();
        }
    };

    const handleSaveTeacher = () => {
        if (isEditing) {
            updateTeacher(currentTeacher);
        } else {
            addTeacher(currentTeacher);
        }
        setIsModalOpen(false);
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>Teachers</h1>
                    <p style={{ color: 'var(--text-light)' }}>Manage faculty appointments ({filteredTeachers.length} shown).</p>
                </div>
                <div className="input-group" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>

                    {/* Filters */}
                    <div style={{ display: 'flex', gap: '8px', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
                        <select
                            className="input-field"
                            style={{ padding: '4px 8px', height: 'auto', border: 'none', background: filterSem === 'All' ? 'transparent' : '#fff', fontSize: '0.85rem' }}
                            value={filterSem}
                            onChange={(e) => setFilterSem(e.target.value)}
                        >
                            <option value="All">All Sems</option>
                            {['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'].map(s => <option key={s} value={s}>Sem {s}</option>)}
                        </select>
                        <select
                            className="input-field"
                            style={{ padding: '4px 8px', height: 'auto', border: 'none', background: filterSec === 'All' ? 'transparent' : '#fff', fontSize: '0.85rem' }}
                            value={filterSec}
                            onChange={(e) => setFilterSec(e.target.value)}
                        >
                            <option value="All">All Sections</option>
                            {['A', 'B', 'C', 'D', 'E'].map(s => <option key={s} value={s}>Section {s}</option>)}
                        </select>
                    </div>

                    <div style={{ position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                        <input
                            type="text"
                            placeholder="Search names or subjects..."
                            className="input-field"
                            style={{ paddingLeft: '36px', minWidth: '200px' }}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <button className="btn btn-primary" onClick={openAddModal}>
                        <Plus size={18} style={{ marginRight: '0.5rem' }} />
                        Add Teacher
                    </button>

                    <button
                        className="btn btn-outline"
                        onClick={handleClearAll}
                        style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>

            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Dept</th>
                            <th>Sem</th>
                            <th>Subject</th>
                            <th>Section</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredTeachers.length === 0 ? (
                            <tr>
                                <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-light)' }}>
                                    {teachers.length === 0 ? "No teacher assignments found. Add one to get started." : "No faculty match your filters."}
                                </td>
                            </tr>
                        ) : (
                            filteredTeachers.map((teacher) => (
                                <tr key={teacher.id}>
                                    <td>
                                        <div style={{ fontWeight: 500 }}>{teacher.name}</div>
                                    </td>
                                    <td>
                                        <span className="badge badge-info">{teacher.department}</span>
                                    </td>
                                    <td>
                                        <span className="badge badge-outline">{teacher.semester || '-'}</span>
                                    </td>
                                    <td>
                                        {teacher.subject || '-'}
                                    </td>
                                    <td>
                                        {teacher.assignedClass || '-'}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                            <button className="btn btn-outline" style={{ padding: '6px' }} onClick={() => handleEdit(teacher)}>
                                                <Edit2 size={16} />
                                            </button>
                                            <button className="btn btn-outline" style={{ padding: '6px', color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => handleDelete(teacher.id)}>
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
                title={isEditing ? "Edit Teacher" : "Add New Teacher"}
                footer={
                    <>
                        <button className="btn btn-outline" onClick={() => setIsModalOpen(false)}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSaveTeacher}>{isEditing ? "Save Changes" : "Add Teacher"}</button>
                    </>
                }
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="form-group">
                        <label className="form-label">Full Name</label>
                        <input
                            type="text"
                            className="input-field w-full"
                            placeholder="e.g. Dr. Sarah Wilson"
                            value={currentTeacher.name}
                            onChange={(e) => setCurrentTeacher({ ...currentTeacher, name: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Department</label>
                        <input
                            type="text"
                            className="input-field w-full"
                            placeholder="e.g. Computer Science"
                            value={currentTeacher.department}
                            onChange={(e) => setCurrentTeacher({ ...currentTeacher, department: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Subject</label>
                        <select
                            className="input-field w-full"
                            value={currentTeacher.subject || ''}
                            onChange={(e) => setCurrentTeacher({ ...currentTeacher, subject: e.target.value })}
                        >
                            <option value="">Select a subject...</option>
                            {subjects.map(subject => (
                                <option key={subject.id} value={`${subject.code} - ${subject.name}`}>
                                    {subject.code} - {subject.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Semester</label>
                        <select
                            className="form-select"
                            value={currentTeacher.semester || ''}
                            onChange={(e) => setCurrentTeacher({ ...currentTeacher, semester: e.target.value })}
                        >
                            <option value="">Select Semester...</option>
                            {['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'].map(s => (
                                <option key={s} value={s}>Semester {s}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Section</label>
                        <select
                            className="form-select"
                            value={currentTeacher.assignedClass || ''}
                            onChange={(e) => setCurrentTeacher({ ...currentTeacher, assignedClass: e.target.value })}
                        >
                            <option value="">Select a section...</option>
                            {['Section A', 'Section B', 'Section C', 'Section D', 'Section E'].map(sec => (
                                <option key={sec} value={sec}>{sec}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </Modal>
            <DataImporter />
        </div>
    );
};

export default Teachers;
