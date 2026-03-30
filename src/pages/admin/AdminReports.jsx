import React, { useState, useEffect } from 'react';
    import { motion } from 'framer-motion';
    import { Eye, ShieldCheck, AlertTriangle, Trash2 } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { toast } from '@/components/ui/use-toast';

    const mockReports = [
        { id: 1, reporter: 'User #1234', target: 'User #5678', reason: 'Inappropriate photos', date: new Date().toISOString(), status: 'Pending' },
        { id: 2, reporter: 'User #2345', target: 'User #6789', reason: 'Spamming messages', date: new Date(Date.now() - 86400000).toISOString(), status: 'Pending' },
        { id: 3, reporter: 'User #3456', target: 'User #7890', reason: 'Harassment', date: new Date(Date.now() - 172800000).toISOString(), status: 'Reviewed' },
        { id: 4, reporter: 'User #4567', target: 'User #8901', reason: 'Fake profile', date: new Date(Date.now() - 259200000).toISOString(), status: 'Dismissed' },
    ];

    const AdminReports = () => {
        const [reports, setReports] = useState([]);

        useEffect(() => {
            const storedReports = JSON.parse(localStorage.getItem('singlesReports'));
            setReports(storedReports || mockReports);
        }, []);

        const updateReportStatus = (id, status) => {
            const updatedReports = reports.map(r => r.id === id ? { ...r, status } : r);
            setReports(updatedReports);
            localStorage.setItem('singlesReports', JSON.stringify(updatedReports));
            toast({ title: `Report ${id} marked as ${status}.` });
        };
        
        const getStatusClass = (status) => {
            switch(status) {
                case 'Pending': return 'bg-yellow-100 text-yellow-700';
                case 'Reviewed': return 'bg-blue-100 text-blue-700';
                case 'Dismissed': return 'bg-gray-100 text-gray-700';
                default: return 'bg-gray-100 text-gray-700';
            }
        };

        return (
            <div>
                <h1 className="text-3xl font-bold mb-6">User Reports</h1>
                <div className="card-gradient p-6 rounded-xl shadow-lg">
                    <div className="space-y-4">
                        {reports.map((report, index) => (
                            <motion.div
                                key={report.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="bg-white/70 p-4 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4"
                            >
                                <div className="flex-1">
                                    <div className="flex items-center gap-4 mb-2">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusClass(report.status)}`}>{report.status}</span>
                                        <p className="font-bold">{report.reporter} <span className="font-normal">reported</span> {report.target}</p>
                                    </div>
                                    <p className="text-gray-600"><strong>Reason:</strong> {report.reason}</p>
                                    <p className="text-xs text-gray-400 mt-1">Reported on: {new Date(report.date).toLocaleString()}</p>
                                </div>
                                <div className="flex gap-2 flex-shrink-0">
                                    <Button size="sm" variant="outline" onClick={() => toast({title: "🚧 Feature not implemented"})}>
                                        <Eye className="mr-2 h-4 w-4" /> View Context
                                    </Button>
                                    <Button size="sm" onClick={() => updateReportStatus(report.id, 'Reviewed')}>
                                        <ShieldCheck className="mr-2 h-4 w-4" /> Mark Reviewed
                                    </Button>
                                     <Button size="sm" variant="secondary" onClick={() => updateReportStatus(report.id, 'Dismissed')}>
                                        <Trash2 className="mr-2 h-4 w-4" /> Dismiss
                                    </Button>
                                    <Button size="sm" variant="destructive" onClick={() => toast({title: "🚧 Feature not implemented"})}>
                                        <AlertTriangle className="mr-2 h-4 w-4" /> Warn Target
                                    </Button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    export default AdminReports;