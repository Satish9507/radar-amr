import { useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, Beaker } from "lucide-react";
import Header from "../components/Header";
import NavBar from "../components/NavBar";
import Footer from "../components/Footer";

export default function ComingSoon({ tool = "Tool", desc = "" }) {
  const navigate = useNavigate();

  return (
    <div style={{ background:"#F0F4F8", minHeight:"100vh", fontFamily:"'Inter',sans-serif" }}>
      <Header/>
      <NavBar/>

      <main className="flex items-center justify-center min-h-[calc(100vh-160px)] px-4 py-10">
        <div style={{ textAlign:"center", maxWidth:440, width:"100%" }}>

          <div style={{ width:72, height:72, borderRadius:"50%",
                        background:"#DBEAFE", border:"2px solid #BFDBFE",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        margin:"0 auto 20px" }}>
            <Clock size={32} color="#1E40AF"/>
          </div>

          <div style={{ display:"inline-flex", alignItems:"center", gap:6,
                        background:"#FEF3C7", border:"1px solid #FCD34D",
                        borderRadius:999, padding:"4px 14px", marginBottom:14 }}>
            <Beaker size={12} color="#D97706"/>
            <span style={{ color:"#D97706", fontSize:14, fontWeight:600 }}>In Development</span>
          </div>

          <h1 style={{ color:"#0F172A", fontWeight:800, marginBottom:10 }}
              className="text-2xl md:text-3xl">
            {tool} — Coming Soon
          </h1>

          {desc && (
            <p style={{ color:"#64748B", lineHeight:1.7, marginBottom:8 }}
               className="text-sm md:text-base">{desc}</p>
          )}

          <p style={{ color:"#94A3B8", marginBottom:28 }} className="text-xs md:text-sm">
            This tool is currently in development and will be available in a future release.
            The RQ tool is live and ready to use now.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={()=>navigate("/rq")}
                    style={{ background:"#1E40AF", color:"white", border:"none",
                             borderRadius:10, fontSize:16, fontWeight:600, cursor:"pointer",
                             display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}
                    className="px-5 py-2.5">
              <Beaker size={15}/> Use RQ Tool
            </button>
            <button onClick={()=>navigate("/")}
                    style={{ background:"white", color:"#475569",
                             border:"1px solid #CBD5E1", borderRadius:10,
                             fontSize:16, fontWeight:500, cursor:"pointer",
                             display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}
                    className="px-5 py-2.5">
              <ArrowLeft size={15}/> Back to Home
            </button>
          </div>
        </div>
      </main>

      <Footer/>
    </div>
  );
}
