import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabase';
import bcrypt from 'bcryptjs';

const DataContext = createContext();

export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }) => {
    // Local state (optimistic UI)
    const [teachers, _setTeachers] = useState([]);
    const [subjects, _setSubjects] = useState([]);
    const [schedule, _setSchedule] = useState({});
    const [facultyAccounts, _setFacultyAccounts] = useState([]);
    const [adminAccounts, _setAdminAccounts] = useState([]);
    const [timeSlots, _setTimeSlots] = useState([]);
    const [preemptiveConstraints, _setPreemptiveConstraints] = useState({});
    const [department, _setDepartment] = useState('General');
    const [loading, setLoading] = useState(true);

    // Initial Data Fetch
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch basic tables
                const { data: tData } = await supabase.from('teachers').select('*');
                if (tData) _setTeachers(tData);

                const { data: sData } = await supabase.from('subjects').select('*');
                if (sData) _setSubjects(sData);

                const { data: fData } = await supabase.from('faculty_accounts').select('*');
                if (fData) _setFacultyAccounts(fData);

                const { data: aData } = await supabase.from('admins').select('*');
                if (aData) _setAdminAccounts(aData);

                // Fetch App Settings (JSON Blobs)
                const { data: settings } = await supabase.from('app_settings').select('*');
                const settingsMap = (settings || []).reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});

                if (settingsMap.time_slots) _setTimeSlots(settingsMap.time_slots);
                else {
                    // Default Time Slots
                    _setTimeSlots([
                        { id: 'p1', startTime: '08:45', endTime: '09:40', label: 'P1', type: 'teaching' },
                        { id: 'p2', startTime: '09:40', endTime: '10:35', label: 'P2', type: 'teaching' },
                        { id: 'b1', startTime: '10:35', endTime: '10:55', label: 'BREAK', type: 'break' },
                        { id: 'p3', startTime: '10:55', endTime: '11:45', label: 'P3', type: 'teaching' },
                        { id: 'p4', startTime: '11:45', endTime: '12:35', label: 'P4', type: 'teaching' },
                        { id: 'l1', startTime: '12:35', endTime: '01:45', label: 'LUNCH', type: 'break' },
                        { id: 'p5', startTime: '01:45', endTime: '02:35', label: 'P5', type: 'teaching' },
                        { id: 'p6', startTime: '02:35', endTime: '03:25', label: 'P6', type: 'teaching' },
                        { id: 'p7', startTime: '03:25', endTime: '04:15', label: 'P7', type: 'teaching' }
                    ]);
                }

                if (settingsMap.constraints) _setPreemptiveConstraints(settingsMap.constraints);
                if (settingsMap.department) _setDepartment(settingsMap.department);

                // Fetch Schedules
                const { data: schedData } = await supabase.from('schedules').select('*');
                const schedMap = (schedData || []).reduce((acc, row) => ({ ...acc, [row.semester]: row.data }), {});
                _setSchedule(schedMap);

            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // --- Teachers ---
    const addTeachers = async (newTeachers) => {
        // Optimistic
        _setTeachers(prev => {
            const existingIds = new Set(prev.map(t => t.id));
            const uniqueNew = newTeachers.filter(t => !existingIds.has(t.id));
            return [...prev, ...uniqueNew];
        });

        const safeData = newTeachers.map(t => JSON.parse(JSON.stringify(t)));
        const { error } = await supabase.from('teachers').upsert(safeData);
        if (error) console.error("Error adding teachers:", error);
    };

    const deleteTeachers = async (id) => {
        // Find teacher to get name for account deletion
        const teacherToDelete = teachers.find(t => t.id === id);

        _setTeachers(prev => prev.filter(t => t.id !== id));
        const { error } = await supabase.from('teachers').delete().eq('id', id);

        if (teacherToDelete) {
            // Also delete from faculty_accounts matching the name
            // Note: This matches by exact name which is the best link we have currently
            _setFacultyAccounts(prev => prev.filter(a => a.name !== teacherToDelete.name));
            await supabase.from('faculty_accounts').delete().eq('name', teacherToDelete.name);
        }

        if (error) console.error("Error deleting teacher:", error);
    };

    const clearTeachers = async () => {
        _setTeachers([]);
        _setFacultyAccounts([]);

        const { error: tError } = await supabase.from('teachers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        const { error: fError } = await supabase.from('faculty_accounts').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        if (tError) console.error("Error clearing teachers:", tError);
        if (fError) console.error("Error clearing faculty accounts:", fError);
    };

    // Exported setTeachers (for Excel Import - Replaces All)
    const setTeachers = async (newVal) => {
        const resolved = typeof newVal === 'function' ? newVal(teachers) : newVal;
        _setTeachers(resolved);

        if (resolved.length === 0) {
            await supabase.from('teachers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            return;
        }

        await supabase.from('teachers').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        const safeData = resolved.map(t => JSON.parse(JSON.stringify(t)));
        const { error } = await supabase.from('teachers').insert(safeData);
        if (error) console.error("Error syncing teachers:", error);
    };

    // --- Subjects ---
    const addSubjects = async (newSubjects) => {
        _setSubjects(prev => {
            const existingIds = new Set(prev.map(s => s.id));
            const uniqueNew = newSubjects.filter(s => !existingIds.has(s.id));
            return [...prev, ...uniqueNew];
        });
        const safeData = newSubjects.map(s => JSON.parse(JSON.stringify(s)));
        const { error } = await supabase.from('subjects').upsert(safeData);
        if (error) console.error("Error adding subjects:", error);
    };

    const deleteSubjects = async (id) => {
        _setSubjects(prev => prev.filter(s => s.id !== id));
        const { error } = await supabase.from('subjects').delete().eq('id', id);
        if (error) console.error("Error deleting subject:", error);
    };

    const clearSubjects = async () => {
        _setSubjects([]);
        const { error } = await supabase.from('subjects').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) console.error("Error clearing subjects:", error);
    };

    const setSubjects = async (newVal) => {
        const resolved = typeof newVal === 'function' ? newVal(subjects) : newVal;
        _setSubjects(resolved);

        if (resolved.length === 0) {
            await supabase.from('subjects').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            return;
        }

        await supabase.from('subjects').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        const safeData = resolved.map(s => JSON.parse(JSON.stringify(s)));
        const { error } = await supabase.from('subjects').insert(safeData);
        if (error) console.error("Error syncing subjects:", error);
    };

    // Alias for compatibility
    const updateSubjects = setSubjects;

    // --- Schedules ---
    const updateSchedule = async (semester, newSchedule) => {
        _setSchedule(prev => ({ ...prev, [semester]: newSchedule }));

        // Upsert
        const { error } = await supabase.from('schedules').upsert({
            semester,
            data: newSchedule,
            updated_at: new Date()
        });
        if (error) console.error("Error updating schedule:", error);
    };

    const clearSchedules = async () => {
        _setSchedule({});
        // Use a condition that matches all rows. 'semester' should not be 'invalid_value'
        const { error } = await supabase.from('schedules').delete().neq('semester', 'invalid_value');
        if (error) console.error("Error clearing schedules:", error);
    };

    // --- Faculty Accounts ---
    const addFacultyAccounts = async (newAccounts) => {
        // Hash passwords before storing
        const hashedAccounts = newAccounts.map(acc => ({
            ...acc,
            password: (acc.password && !acc.password.toString().startsWith('$2'))
                ? bcrypt.hashSync(acc.password, 10)
                : acc.password
        }));

        _setFacultyAccounts(prev => {
            const accountMap = new Map(prev.map(a => [a.email, a]));
            hashedAccounts.forEach(acc => accountMap.set(acc.email, acc));
            return Array.from(accountMap.values());
        });

        const safeData = hashedAccounts.map(a => JSON.parse(JSON.stringify(a)));
        const { error } = await supabase.from('faculty_accounts').upsert(safeData);
        if (error) console.error("Error adding faculty accounts:", error);
    };

    const deleteFacultyAccount = async (id) => {
        _setFacultyAccounts(prev => prev.filter(a => a.id !== id));
        await supabase.from('faculty_accounts').delete().eq('id', id);
    };

    const updateFacultyAvailability = async (id, availability) => {
        /* Placeholder if needed later */
    };

    const updateFacultyPermission = async (id, canGenerate) => {
        _setFacultyAccounts(prev => prev.map(a => a.id === id ? { ...a, can_generate: canGenerate } : a));
        const { error } = await supabase.from('faculty_accounts').update({ can_generate: canGenerate }).eq('id', id);
        if (error) console.error("Error updating faculty permission:", error);
    };

    const updateFacultyPassword = async (id, newPassword) => {
        const hashedPassword = bcrypt.hashSync(newPassword, 10);
        _setFacultyAccounts(prev => prev.map(a => a.id === id ? { ...a, password: hashedPassword } : a));
        const { error } = await supabase.from('faculty_accounts').update({ password: hashedPassword }).eq('id', id);
        if (error) console.error("Error updating faculty password:", error);
        return error;
    };

    const clearFacultyAccounts = async () => {
        _setFacultyAccounts([]);
        const { error } = await supabase.from('faculty_accounts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) console.error("Error clearing faculty accounts:", error);
    };

    const setFacultyAccounts = async (newVal) => {
        const resolved = typeof newVal === 'function' ? newVal(facultyAccounts) : newVal;

        // Hash passwords if needed
        const hashedResolved = resolved.map(acc => ({
            ...acc,
            password: (acc.password && !acc.password.toString().startsWith('$2'))
                ? bcrypt.hashSync(acc.password, 10)
                : acc.password
        }));

        _setFacultyAccounts(hashedResolved);

        if (hashedResolved.length === 0) {
            await supabase.from('faculty_accounts').delete().neq('id', '0');
            return;
        }

        await supabase.from('faculty_accounts').delete().neq('id', '0');
        const safe = hashedResolved.map(x => JSON.parse(JSON.stringify(x)));
        await supabase.from('faculty_accounts').insert(safe);
    };

    // --- Admin Accounts ---
    // --- Admin Accounts ---
    const addAdminAccount = async (newAdmin) => {
        const hashedAdmin = {
            ...newAdmin,
            password: (newAdmin.password && !newAdmin.password.toString().startsWith('$2'))
                ? bcrypt.hashSync(newAdmin.password, 10)
                : newAdmin.password
        };

        // Optimistically add to UI (temporary ID)
        const tempId = Date.now().toString();
        const optimisticAdmin = { ...hashedAdmin, id: tempId };

        _setAdminAccounts(prev => [...prev, optimisticAdmin]);

        const { data, error } = await supabase.from('admins').insert(hashedAdmin).select().single();

        if (error) {
            console.error("Error adding admin:", error);
            // Revert on error
            _setAdminAccounts(prev => prev.filter(a => a.id !== tempId));
        } else if (data) {
            // Replace optimistic with real data
            _setAdminAccounts(prev => prev.map(a => a.id === tempId ? data : a));
        }
    };

    const deleteAdminAccount = async (id) => {
        _setAdminAccounts(prev => prev.filter(a => a.id !== id));
        await supabase.from('admins').delete().eq('id', id);
    };

    // --- Settings (TimeSlots, etc) ---
    const setTimeSlots = async (newVal) => {
        const resolved = typeof newVal === 'function' ? newVal(timeSlots) : newVal;
        _setTimeSlots(resolved);
        const { error } = await supabase.from('app_settings').upsert({ key: 'time_slots', value: resolved });
        if (error) console.error("Error saving time slots:", error);
    };

    const setPreemptiveConstraints = async (newVal) => {
        const resolved = typeof newVal === 'function' ? newVal(preemptiveConstraints) : newVal;
        _setPreemptiveConstraints(resolved);
        const { error } = await supabase.from('app_settings').upsert({ key: 'constraints', value: resolved });
        if (error) console.error("Error saving constraints:", error);
    };

    const clearPreemptiveConstraints = async () => {
        _setPreemptiveConstraints({});
        const { error } = await supabase.from('app_settings').delete().eq('key', 'constraints');
        if (error) console.error("Error clearing constraints:", error);
    };

    const setDepartment = async (newVal) => {
        const resolved = typeof newVal === 'function' ? newVal(department) : newVal;
        _setDepartment(resolved);
        await supabase.from('app_settings').upsert({ key: 'department', value: resolved });
    };

    return (
        <DataContext.Provider value={{
            teachers,
            subjects,
            schedule,
            facultyAccounts,
            adminAccounts,
            timeSlots,
            preemptiveConstraints,
            department,
            loading,

            // Actions
            addTeachers,
            deleteTeachers,
            clearTeachers,
            setTeachers,

            addSubjects,
            updateSubjects,
            deleteSubjects,
            clearSubjects,
            setSubjects,

            updateSchedule,
            clearSchedules,

            addFacultyAccounts,
            deleteFacultyAccount,
            updateFacultyPermission,
            updateFacultyPassword,
            clearFacultyAccounts,
            setFacultyAccounts,

            addAdminAccount,
            deleteAdminAccount,

            setTimeSlots,
            setPreemptiveConstraints,
            clearPreemptiveConstraints,
            setDepartment
        }}>
            {children}
        </DataContext.Provider>
    );
};