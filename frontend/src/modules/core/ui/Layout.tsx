import { Outlet } from 'react-router-dom';
import Header from '../../../components/Header';

export default function Layout() {
    return (
        <div className="flex flex-col h-screen bg-background">
            <Header />
            <main className="flex-1 overflow-auto bg-background/50">
                <Outlet />
            </main>
        </div>
    );
}
