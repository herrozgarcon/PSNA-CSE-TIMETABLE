import React, { useRef, useState } from 'react';
import { Upload, X, Check, AlertCircle, FileText, Download, Briefcase, Database } from 'lucide-react';
import * as XLSX from 'xlsx';
import Modal from './Modal';
import { useData } from '../context/DataContext';

const DataImporter = () => {
    const { addTeachers, addSubjects, clearTeachers, clearSubjects } = useData();

    // State
    const fileInputRef = useRef(null);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [fileName, setFileName] = useState('');
    const [importMode, setImportMode] = useState('strict'); // 'strict' | 'master'
    const [clearBeforeImport, setClearBeforeImport] = useState(false);

    // Status
    const [validationStatus, setValidationStatus] = useState('idle'); // idle, validating, success, error
    const [validationReport, setValidationReport] = useState(null);

    // Staging Data
    const [pendingTeachers, setPendingTeachers] = useState([]);
    const [pendingSubjects, setPendingSubjects] = useState([]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFileName(file.name);
            setValidationStatus('validating');
            parseExcel(file);
        }
    };

    const resetImporter = () => {
        setFileName('');
        setValidationStatus('idle');
        setValidationReport(null);
        setPendingTeachers([]);
        setPendingSubjects([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const parseExcel = (file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheets = {};
                workbook.SheetNames.forEach(sheetName => {
                    sheets[sheetName] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 'A', defval: "" });
                });

                // Detect Allocation Format (PSNA Style)
                const isAllocationFormat = workbook.SheetNames.some(name => {
                    const rows = sheets[name];
                    if (rows.length < 10) return false;
                    const headerRow = rows.find(r => Object.values(r).some(v => String(v).includes('Subj Code & Name')));
                    return !!headerRow;
                });

                if (isAllocationFormat) {
                    processAllocationFormat(sheets, workbook.SheetNames);
                } else if (importMode === 'strict') {
                    // Convert back to keyed objects for existing logic
                    const keyedSheets = {};
                    workbook.SheetNames.forEach(name => {
                        keyedSheets[name] = XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: "" });
                    });
                    validateStrict(keyedSheets, workbook.SheetNames);
                } else {
                    const keyedSheets = {};
                    workbook.SheetNames.forEach(name => {
                        keyedSheets[name] = XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: "" });
                    });
                    validateMaster(keyedSheets);
                }

            } catch (err) {
                console.error("Excel Parse Error:", err);
                setValidationStatus('error');
                setValidationReport({ headerErrors: ['Failed to parse Excel file. Ensure it is a valid .xlsx file.'] });
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const processAllocationFormat = (sheets) => {
        const facultyMap = new Map();
        const subjects = [];
        const assignments = [];
        const headerErrors = [];

        const sheetKeys = Object.keys(sheets);

        // 1. Scan ALL sheets for Faculty Map (Initials -> Full Name)
        sheetKeys.forEach(name => {
            const rows = sheets[name];
            rows.forEach(row => {
                const values = Object.values(row).map(v => String(v).trim());
                // Look for rows that look like: "Initial" | "Full Name" or "Name" | "Initials"
                // Heuristic: two adjacent strings, one short (1-4 chars) one long
                if (values.length >= 2) {
                    for (let i = 0; i < values.length - 1; i++) {
                        const v1 = values[i];
                        const v2 = values[i + 1];
                        if (v1.length >= 2 && v1.length <= 4 && v2.length > 5 && !v2.includes(' ')) {
                            // Likely Initial followed by some code? No, usually Initial | Full Name
                        }
                        // Looking for "NU" | "Dr. N. Umamaheswari"
                        if ((v1.length >= 2 && v1.length <= 5 && v2.length > 5 && (v2.includes(' ') || v2.includes('.'))) ||
                            (v2.length >= 2 && v2.length <= 5 && v1.length > 5 && (v1.includes(' ') || v1.includes('.')))) {
                            const initial = v1.length <= 5 ? v1 : v2;
                            const fullName = v1.length > 5 ? v1 : v2;
                            if (initial && fullName && !fullName.toLowerCase().includes('subject')) {
                                facultyMap.set(initial.toUpperCase(), { name: fullName, department: 'CSE' });
                            }
                        }
                    }
                }
            });
        });

        // 2. Identify the Main Sheet and Parse Subjects/Assignments
        sheetKeys.forEach(sheetName => {
            const rows = sheets[sheetName];
            if (!rows || rows.length === 0) return;

            // Find header row (the one with 'subj code & name')
            let headerRowIdx = -1;
            for (let i = 0; i < Math.min(rows.length, 25); i++) {
                if (Object.values(rows[i]).some(v => String(v).toLowerCase().includes('subj code & name'))) {
                    headerRowIdx = i;
                    break;
                }
            }

            if (headerRowIdx !== -1) {
                const headerRow = rows[headerRowIdx];
                const colMap = {};
                Object.entries(headerRow).forEach(([key, val]) => {
                    const v = String(val).toLowerCase().trim();
                    if (v.includes('sem. no') || v === 'sem' || v === 'semester') colMap.semester = key;
                    if (v.includes('code') && !v.includes('name')) colMap.code = key;
                    if (v.includes('subj code & name')) colMap.fullName = key;
                    if (v.includes('no of section') || v.includes('section count')) colMap.sectionsCount = key;
                    if (v.includes('credit')) colMap.credit = key;
                    if (['a', 'b', 'c', 'd', 'e'].includes(v)) {
                        if (!colMap.secCols) colMap.secCols = [];
                        colMap.secCols.push({ id: v.toUpperCase(), col: key });
                    }
                });

                if (!colMap.fullName) return; // Not the main allocation sheet

                const subjectMap = new Map();
                for (let i = headerRowIdx + 1; i < rows.length; i++) {
                    const row = rows[i];
                    const rawFullName = row[colMap.fullName];
                    if (!rawFullName || String(rawFullName).toLowerCase().includes('total')) continue;

                    const code = row[colMap.code] || (String(rawFullName).match(/^[A-Z0-9]+/i)?.[0] || 'UNK');
                    const name = String(rawFullName).replace(code, '').trim();
                    const semester = String(row[colMap.semester] || '').trim();
                    const credits = String(row[colMap.credit] || '3').trim();

                    if (!subjectMap.has(code)) {
                        subjectMap.set(code, {
                            code,
                            name,
                            semester,
                            type: String(name).toLowerCase().includes('lab') ? 'Lab' : 'Lecture',
                            credits: (credits === '0' || !credits) ? '3' : credits
                        });
                    }

                    if (colMap.secCols) {
                        colMap.secCols.forEach(sec => {
                            const teacherInitial = String(row[sec.col] || '').trim().toUpperCase();
                            if (teacherInitial && teacherInitial !== '0' && teacherInitial !== '-') {
                                const faculty = facultyMap.get(teacherInitial) || { name: teacherInitial, department: 'CSE' };
                                assignments.push({
                                    name: faculty.name,
                                    department: faculty.department,
                                    subject: `${code} - ${name}`,
                                    semester: semester,
                                    assignedClass: `Section ${sec.id}`,
                                    initial: teacherInitial
                                });
                            }
                        });
                    }
                }
                subjects.push(...Array.from(subjectMap.values()));
            }
        });

        if (assignments.length === 0) {
            headerErrors.push("Could not extract any assignments. Ensure the sheet has 'Subj Code & Name' and columns 'A', 'B', 'C', etc.");
        }

        setPendingTeachers(assignments);
        setPendingSubjects(subjects);
        setValidationReport({
            validTeachers: assignments.length,
            validSubjects: subjects.length,
            badRows: [],
            headerErrors: headerErrors,
            mode: 'PSNA Allocation Format (Enhanced)',
            preview: assignments.slice(0, 3)
        });
        setValidationStatus(headerErrors.length > 0 ? 'error' : 'success');
    };

    // --- STRICT MODE: Flat Assignment File ---
    const validateStrict = (sheets, sheetNames) => {
        let validTeachers = [];
        let extractedSubjects = new Map();
        let badRows = [];
        let headerErrors = [];
        let validSheetFound = false;

        const sheetKeys = Object.keys(sheets);

        for (const sheetName of sheetKeys) {
            const rows = sheets[sheetName];
            if (!rows || rows.length === 0) continue;

            const headers = Object.keys(rows[0]);

            const findCol = (candidates) => headers.find(h => candidates.some(c => h.toLowerCase().trim() === c.toLowerCase() || h.toLowerCase().trim().includes(c.toLowerCase())));

            const map = {
                name: findCol(['Teacher Name', 'Faculty Name', 'Name of the Teacher', 'Teacher']),
                dept: findCol(['Department', 'Dept', 'Branch']),
                subject: findCol(['Subject Code', 'Subject Name', 'Subject', 'Course', 'Paper']),
                class: findCol(['Class', 'Assigned Class', 'Year/Sec', 'Section', 'Year', 'Sem']),
                room: findCol(['Room', 'Lab', 'Venue', 'Location', 'Place']),
                alt1: findCol(['Alt Subject 1', 'Alternative 1', 'Secondary Subject']),
                alt2: findCol(['Alt Subject 2', 'Alternative 2']),
                alt3: findCol(['Alt Subject 3', 'Alternative 3'])
            };

            if (map.name) {
                validSheetFound = true;
                const missing = [];
                if (!map.name) missing.push("Teacher Name");
                if (!map.dept) missing.push("Department");
                if (!map.subject) missing.push("Subject");
                if (!map.class) missing.push("Class");

                if (missing.length > 0) {
                    const otherSheetHasSubject = sheetKeys.some(s => s !== sheetName && sheets[s][0] && Object.keys(sheets[s][0]).some(k => k.toLowerCase().includes('subject')));
                    if (otherSheetHasSubject && missing.includes("Subject")) {
                        headerErrors.push(`Multi-sheet file detected. Found Teacher Name in '${sheetName}' but Subject data seems to be in another sheet.`);
                        headerErrors.push(`Strict Mode requires a single "Flat" sheet with all columns: Teacher, Dept, Subject, Class.`);
                        headerErrors.push(`Suggestion: Switch to 'Master Data' mode.`);
                    } else {
                        headerErrors.push(`Sheet '${sheetName}' is missing required columns: ${missing.join(', ')}.`);
                    }
                    continue;
                }

                rows.forEach((row, idx) => {
                    const rowNum = idx + 2;
                    const name = row[map.name] ? String(row[map.name]).trim() : '';
                    const dept = row[map.dept] ? String(row[map.dept]).trim() : 'General';
                    const subCodeRaw = row[map.subject] ? String(row[map.subject]).trim() : '';
                    const classRaw = row[map.class] ? String(row[map.class]).trim() : '';

                    if (!name) {
                        badRows.push({ row: rowNum, missing: "Teacher Name" });
                    } else {
                        let finalClass = classRaw || 'Unassigned';
                        if (classRaw) {
                            const strClass = classRaw.toUpperCase();
                            const yearMatch = strClass.match(/\b([1-4]|I{1,3}V?|1ST|2ND|3RD|4TH)\b/i);
                            const secMatch = strClass.match(/\b([A-D])\b/i);
                            const normY = (y) => ['I', '1ST', '1'].includes(y) ? '1' : (['II', '2ND', '2'].includes(y) ? '2' : (['III', '3RD', '3'].includes(y) ? '3' : '4'));
                            if (yearMatch && secMatch) finalClass = `Year ${normY(yearMatch[0])} - Section ${secMatch[0]}`;
                        }

                        if (subCodeRaw && !extractedSubjects.has(subCodeRaw)) {
                            extractedSubjects.set(subCodeRaw, {
                                code: subCodeRaw,
                                name: subCodeRaw,
                                type: subCodeRaw.toLowerCase().includes('lab') ? 'Lab' : 'Lecture',
                                credits: '3'
                            });
                        }

                        validTeachers.push({
                            name: name,
                            department: dept,
                            subject: subCodeRaw || '-',
                            assignedClass: finalClass,
                            alternatives: [row[map.alt1], row[map.alt2], row[map.alt3]].filter(Boolean).map(a => String(a).trim())
                        });
                    }
                });
                break;
            }
        }

        if (!validSheetFound) {
            headerErrors.push("Could not find any sheet with a 'Teacher Name' column.");
        }

        setPendingTeachers(validTeachers);
        setPendingSubjects(Array.from(extractedSubjects.values()));
        setValidationReport({
            validTeachers: validTeachers.length,
            validSubjects: extractedSubjects.size,
            badRows: badRows,
            headerErrors: headerErrors,
            mode: 'Strict Assignment',
            preview: validTeachers.slice(0, 3)
        });
        setValidationStatus((headerErrors.length > 0 || (badRows.length === rows?.length && rows?.length > 0)) ? 'error' : 'success');
    };

    // --- MASTER MODE ---
    const validateMaster = (sheets) => {
        let teachersFound = [];
        let subjectsFound = [];

        Object.keys(sheets).forEach(name => {
            const rows = sheets[name];
            if (!rows || !rows.length) return;
            const keys = Object.keys(rows[0]).map(k => k.toLowerCase());

            const hasTeacher = keys.some(k => k.includes('teacher') || k.includes('faculty') || k.includes('staff'));
            const hasName = keys.some(k => k.includes('name'));
            const hasCredits = keys.some(k => k.includes('credit') || k.includes('unit'));

            if (hasTeacher || (hasName && !hasCredits)) {
                teachersFound.push(...rows);
            }

            if ((keys.some(k => k.includes('code') || k.includes('subject')) && hasCredits) || keys.some(k => k.includes('course'))) {
                subjectsFound.push(...rows);
            }
        });

        const fuzzyGet = (row, keywords) => {
            const key = Object.keys(row).find(k => keywords.some(kw => k.toLowerCase().includes(kw)));
            return key ? row[key] : '';
        };

        const cleanTeachers = teachersFound.map(t => ({
            name: fuzzyGet(t, ['teacher', 'faculty', 'name']),
            department: fuzzyGet(t, ['dept', 'branch', 'department']) || 'General',
            subject: fuzzyGet(t, ['subject', 'course', 'code', 'paper']) || '-',
            assignedClass: fuzzyGet(t, ['class', 'section', 'year', 'sem']) || '-',
            alternatives: [fuzzyGet(t, ['alt1', 'alt subject 1']), fuzzyGet(t, ['alt2', 'alt subject 2'])].filter(Boolean)
        })).filter(t => t.name);

        const cleanSubjects = subjectsFound.map(s => ({
            name: fuzzyGet(s, ['name', 'title', 'subject', 'course', 'paper']),
            code: fuzzyGet(s, ['code', 'id', 'subject']),
            type: String(fuzzyGet(s, ['type'])).toLowerCase().includes('lab') ? 'Lab' : 'Lecture',
            credits: fuzzyGet(s, ['credit', 'unit', 'hrs']) || '3'
        })).filter(s => s.code && s.name);

        const uniqueTeachers = Array.from(new Map(cleanTeachers.map(t => [t.name + t.subject, t])).values());
        const uniqueSubjects = Array.from(new Map(cleanSubjects.map(s => [s.code, s])).values());

        setPendingTeachers(uniqueTeachers);
        setPendingSubjects(uniqueSubjects);
        setValidationReport({
            validTeachers: uniqueTeachers.length,
            validSubjects: uniqueSubjects.length,
            badRows: [],
            headerErrors: [],
            mode: 'Master Data',
            preview: uniqueTeachers.slice(0, 3)
        });
        setValidationStatus(uniqueTeachers.length > 0 || uniqueSubjects.length > 0 ? 'success' : 'error');
    };

    const downloadSampleFile = () => {
        const facultyData = [
            ["Teacher Name", "Department", "Subject", "Class", "Room/Lab", "Alt Subject 1", "Alt Subject 2"]
        ];

        const subjectData = [
            ["Subject Name", "Subject Code", "Type", "Credits", "Alt Code 1", "Alt Name 1", "Alt Code 2", "Alt Name 2"]
        ];

        const wb = XLSX.utils.book_new();
        const wsFaculty = XLSX.utils.aoa_to_sheet(facultyData);
        const wsSubjects = XLSX.utils.aoa_to_sheet(subjectData);

        XLSX.utils.book_append_sheet(wb, wsFaculty, "Faculty");
        XLSX.utils.book_append_sheet(wb, wsSubjects, "Subjects");

        XLSX.writeFile(wb, "Timetable_Template.xlsx");
    };

    const finalizeImport = () => {
        if (clearBeforeImport) {
            clearTeachers();
            clearSubjects();
        }
        if (pendingTeachers.length > 0) addTeachers(pendingTeachers);
        if (pendingSubjects.length > 0) addSubjects(pendingSubjects);
        setIsUploadModalOpen(false);
        resetImporter();
        alert(`Successfully imported ${pendingTeachers.length} load assignments and ${pendingSubjects.length} unique subjects.`);
    };

    return (
        <>
            <button
                className="btn btn-primary"
                onClick={() => setIsUploadModalOpen(true)}
                style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 1000, boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)', padding: '0.75rem 1.5rem', borderRadius: '50px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
                <Upload size={20} /> <span>Import Excel</span>
            </button>

            <Modal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} title="Import Data" footer={null}>
                <div style={{ textAlign: 'center', padding: '1rem' }}>

                    {/* MODE TOGGLE */}
                    <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '8px', marginBottom: '1.5rem' }}>
                        <button
                            onClick={() => { setImportMode('strict'); resetImporter(); }}
                            style={{ flex: 1, padding: '8px', borderRadius: '6px', fontWeight: '500', border: 'none', background: importMode === 'strict' ? '#fff' : 'transparent', boxShadow: importMode === 'strict' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer' }}
                        >
                            Strict (Assignments)
                        </button>
                        <button
                            onClick={() => { setImportMode('master'); resetImporter(); }}
                            style={{ flex: 1, padding: '8px', borderRadius: '6px', fontWeight: '500', border: 'none', background: importMode === 'master' ? '#fff' : 'transparent', boxShadow: importMode === 'master' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer' }}
                        >
                            Master Data (Flexible)
                        </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                        <input
                            type="checkbox"
                            id="clearData"
                            checked={clearBeforeImport}
                            onChange={(e) => setClearBeforeImport(e.target.checked)}
                        />
                        <label htmlFor="clearData" style={{ cursor: 'pointer', color: clearBeforeImport ? 'var(--danger)' : 'inherit', fontWeight: clearBeforeImport ? '600' : 'normal' }}>
                            Clear existing data before import
                        </label>
                    </div>

                    {validationStatus === 'idle' && (
                        <div style={{ padding: '2rem', border: '2px dashed var(--border)', borderRadius: '8px' }}>
                            <input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
                            <div onClick={() => fileInputRef.current.click()} style={{ cursor: 'pointer' }}>
                                <Upload size={48} style={{ color: 'var(--primary)', marginBottom: '1rem' }} />
                                <p style={{ fontWeight: 600 }}>Click to Upload Excel File</p>
                                <p style={{ fontSize: '0.875rem', color: 'var(--text-light)' }}>
                                    {importMode === 'strict' ? 'Requires Single Sheet with: Name, Dept, Subject, Class' : 'Supports Multi-sheet Catalog (Faculty, Subjects)'}
                                </p>
                            </div>
                            <div style={{ marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                                <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.5rem' }}>Don't have a file?</p>
                                <button
                                    onClick={downloadSampleFile}
                                    style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem', textDecoration: 'underline' }}
                                >
                                    Download Excel Template
                                </button>
                            </div>
                        </div>
                    )}

                    {validationReport && (
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <span style={{ fontWeight: 'bold' }}>{fileName}</span>
                                <button className="btn btn-outline" style={{ fontSize: '0.8rem', padding: '4px' }} onClick={resetImporter}>Change File</button>
                            </div>

                            {validationReport.headerErrors && validationReport.headerErrors.length > 0 ? (
                                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                                    <div style={{ color: '#dc2626', fontWeight: 'bold', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <AlertCircle size={20} /> Import Error ({importMode})
                                    </div>
                                    <ul style={{ margin: 0, paddingLeft: '1rem', color: '#b91c1c', fontSize: '0.9rem' }}>
                                        {validationReport.headerErrors.map((e, i) => <li key={i}>{e}</li>)}
                                    </ul>
                                </div>
                            ) : (
                                <div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                        <div style={{ background: '#eff6ff', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2563eb' }}>{validationReport.validTeachers}</div>
                                            <div style={{ fontSize: '0.8rem' }}>Teachers</div>
                                        </div>
                                        <div style={{ background: '#f0fdf4', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#16a34a' }}>{validationReport.validSubjects}</div>
                                            <div style={{ fontSize: '0.8rem' }}>Subjects</div>
                                        </div>
                                    </div>

                                    {validationReport.preview && validationReport.preview.length > 0 && (
                                        <div style={{ marginBottom: '1.5rem' }}>
                                            <p style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-light)', marginBottom: '0.5rem' }}>Data Preview (First 3 rows):</p>
                                            <div style={{ background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                                <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                                                    <thead>
                                                        <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
                                                            <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', width: '40px' }}>Sem</th>
                                                            <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', width: '80px' }}>Code</th>
                                                            <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Teacher</th>
                                                            <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Section</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {validationReport.preview.map((row, i) => (
                                                            <tr key={i}>
                                                                <td style={{ padding: '8px', borderBottom: i < 2 ? "1px solid #e2e8f0" : "none" }}>{row.semester}</td>
                                                                <td style={{ padding: '8px', borderBottom: i < 2 ? "1px solid #e2e8f0" : "none" }}>{row.subject.split(' - ')[0]}</td>
                                                                <td style={{ padding: '8px', borderBottom: i < 2 ? "1px solid #e2e8f0" : "none" }}>{row.name}</td>
                                                                <td style={{ padding: '8px', borderBottom: i < 2 ? "1px solid #e2e8f0" : "none" }}>{row.assignedClass}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                            {(validationReport.preview.some(r => r.subject === '-' || r.assignedClass === '-')) && (
                                                <p style={{ fontSize: '0.7rem', color: '#ea580c', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                    <AlertCircle size={12} /> Note: Some fields are empty. Check your Excel column headers.
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    <button className="btn btn-primary" style={{ width: '100%' }} onClick={finalizeImport}>
                                        Confirm Import
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </Modal>
        </>
    );
};

export default DataImporter;
