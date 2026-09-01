export const metadata = {
  title: 'Suporte de Turma',
  description: 'Sistema de gestão escolar',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: 'Arial, Helvetica, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
