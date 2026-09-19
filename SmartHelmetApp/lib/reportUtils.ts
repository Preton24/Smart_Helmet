import { Alert } from 'react-native';
import { API_BASE } from '../config/api';
import { TrafficIncident, WasteIncident, PotholeIncident } from './mockData';

export type ReportType = 'Traffic' | 'Garbage' | 'Pothole';

interface BaseReportData {
    type: ReportType;
    subject: string;
    title?: string;
    description?: string;
    location: string;
    timestamp: string;
    photoUrl: string;
    videoUrl?: string;
    reporterDetails?: string;
    metadata?: Record<string, string | number | boolean>;
}

export const sendReportEmail = async (
    type: ReportType,
    incident: TrafficIncident | WasteIncident | PotholeIncident,
    reporterName?: string
) => {
    // Helper to fix stale IPs in URLs
    const sanitizeUrl = (url?: string) => {
        if (!url) return '';
        // If it's a local resource, ensure it use the current API_BASE
        if (url.includes(':3000/outputs/') || url.includes(':3000/results/')) {
            const path = url.split(':3000')[1];
            return `${API_BASE}${path}`;
        }
        return url;
    };

    try {
        let reportData: BaseReportData;

        const timestampStr = new Date(incident.timestamp).toLocaleString('en-US', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });

        if (type === 'Traffic') {
            const trafficIncident = incident as TrafficIncident;
            reportData = {
                type,
                subject: 'Traffic Violation Report',
                title: trafficIncident.type,
                description: `Violation detected: ${trafficIncident.type}`,
                location: trafficIncident.location,
                timestamp: trafficIncident.timestamp,
                photoUrl: sanitizeUrl(trafficIncident.bestFrameUrl || trafficIncident.thumbnail),
                videoUrl: trafficIncident.annotatedVideoUrl ? sanitizeUrl(trafficIncident.annotatedVideoUrl) : undefined,
                reporterDetails: reporterName || 'Smart Helmet User',
                metadata: {
                    'Vehicle Number Plate': trafficIncident.numberPlate,
                    'Violation Type': trafficIncident.type,
                    'Severity': trafficIncident.severity,
                    'Helmet Violations Count': trafficIncident.helmetViolationsCount || 0,
                    'Vehicle Threats Count': trafficIncident.vehicleThreatsCount || 0,
                    'Processing Time (s)': trafficIncident.processingTime || 'N/A',
                }
            };
        } else if (type === 'Garbage') {
            const wasteIncident = incident as WasteIncident;
            reportData = {
                type,
                subject: 'Garbage Issue Report',
                title: wasteIncident.type,
                description: `Waste issue detected: ${wasteIncident.type}`,
                location: wasteIncident.location,
                timestamp: wasteIncident.timestamp,
                photoUrl: wasteIncident.id === 'waste-1' ? wasteIncident.thumbnail : sanitizeUrl(wasteIncident.annotatedImageUrl || wasteIncident.thumbnail),
                reporterDetails: reporterName || 'Smart Helmet User',
                metadata: {
                    'Detection Result': wasteIncident.garbageDetected ? 'Garbage Detected' : 'Clean Area',
                    'Confidence Level': `${((wasteIncident.confidence || 0) * 100).toFixed(1)}%`,
                    'Severity': wasteIncident.severity,
                }
            };
        } else {
            const potholeIncident = incident as PotholeIncident;
            reportData = {
                type,
                subject: 'Pothole Report',
                title: 'Pothole Detection',
                description: 'Potential road hazard detected by smart helmet camera.',
                location: potholeIncident.location,
                timestamp: potholeIncident.timestamp,
                photoUrl: sanitizeUrl(potholeIncident.thumbnail), // Fallback if no specific proof URL
                reporterDetails: reporterName || 'Smart Helmet User',
                metadata: {
                    'Risk Level': potholeIncident.riskLevel,
                    'Detection Source': 'Helmet Camera AI',
                }
            };
        }

        const response = await fetch(`${API_BASE}/api/send-report`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(reportData),
        });

        const data = await response.json();

        if (data.success) {
            Alert.alert('Success', 'Report shared successfully via email.');
            return true;
        } else {
            throw new Error(data.error || 'Failed to send report');
        }
    } catch (error: any) {
        console.error('Error sharing report:', error);
        Alert.alert('Sharing Failed', error.message || 'Please check your connection and try again.');
        return false;
    }
};
