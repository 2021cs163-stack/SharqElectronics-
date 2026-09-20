import { Layout } from "@/components/Layout";
import { LucideIcon, Construction } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

export default function PlaceholderPage({ title, description, icon: Icon }: PlaceholderPageProps) {
  return (
    <Layout>
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="mb-6 rounded-full bg-primary/10 p-6">
          <Icon className="h-12 w-12 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">{title}</h1>
        <p className="text-muted-foreground text-lg max-w-md mx-auto">{description}</p>
        
        <div className="mt-8 flex items-center gap-4 text-sm text-muted-foreground bg-muted/50 px-4 py-2 rounded-full border">
          <Construction className="h-4 w-4" />
          Module under development
        </div>
      </div>
    </Layout>
  );
}
