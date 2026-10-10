import "./globals.css";

export const metadata = {
  title: "Transfinitte Attendance Scanner",
  description: "Official event attendance tracking system by Technical Council",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
