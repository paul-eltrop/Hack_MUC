// Pixel-perfect Next.js conversion of the Stitch "Task Execution" screen
export default function TaskExecution() {
  return (
    <main className="flex-grow pt-24 pb-24 px-6 bg-[#F4F8FB] min-h-screen font-body">
      <div className="max-w-[1024px] mx-auto">

        <div className="mb-12">
          <span className="text-sm font-extrabold tracking-[0.2em] uppercase text-[#E8A838] block mb-3">
            CURRENT OPERATION
          </span>
          <h1 className="text-5xl font-bold tracking-tight text-on-background mb-4 font-headline">
            Ultrasonic Scan of Joint Section 4B
          </h1>
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-[#E8A838]" />
            <p className="text-xl text-secondary font-medium tracking-tight">
              Weld Crack Line 3 · Plant Munich
            </p>
          </div>
        </div>

        <div className="space-y-16">

          <section>
            <div className="mb-8">
              <span className="text-sm font-extrabold tracking-[0.2em] uppercase text-[#E8A838]">
                PROCEDURE STEPS
              </span>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-8 space-y-6">
              {[
                "Clean the weld joint surface with industrial-grade solvent to remove all oxide layers and grease.",
                "Apply ultrasonic couplant gel evenly across the transition zone of Section 4B.",
                "Calibrate the transducer to 5MHz and scan at a 45-degree angle following the longitudinal weld line.",
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-6">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-surface-container-low flex items-center justify-center text-primary font-bold">
                    {i + 1}
                  </span>
                  <p className="text-lg text-on-surface leading-relaxed">{step}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-8">
              <span className="text-sm font-extrabold tracking-[0.2em] uppercase text-[#E8A838]">
                DESCRIPTION
              </span>
            </div>
            <div className="space-y-8">
              <textarea
                className="w-full h-64 bg-surface-container-low border-none rounded-xl p-8 text-lg text-on-surface focus:ring-2 focus:ring-primary/20 placeholder:text-outline/50 resize-none transition-all"
                placeholder="Document scan results, deviations, or specific observations here..."
              />
              <div className="flex justify-center">
                <button className="flex items-center gap-3 px-8 py-4 bg-surface-container-highest text-primary rounded-full hover:bg-surface-container-high transition-all border border-outline-variant/30 font-semibold group shadow-sm">
                  <span className="material-symbols-outlined text-3xl">mic</span>
                  <span className="text-lg">Voice Input</span>
                </button>
              </div>
            </div>
          </section>

          <section>
            <div className="mb-8">
              <span className="text-sm font-extrabold tracking-[0.2em] uppercase text-[#E8A838]">
                DOCUMENTATION
              </span>
            </div>
            <div className="grid grid-cols-1 gap-8">
              <div className="bg-surface-container-low rounded-xl p-12 border-2 border-dashed border-outline-variant/30 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-surface-container-high transition-all">
                <span className="material-symbols-outlined text-4xl text-secondary">add_a_photo</span>
                <span className="text-lg font-semibold text-secondary">Upload evidence photo</span>
              </div>
            </div>
          </section>

          <section className="pt-10">
            <button className="w-full py-10 bg-[#1E5A8A] text-on-primary rounded-xl text-2xl font-black tracking-widest hover:opacity-90 transition-all duration-200 active:scale-[0.99] shadow-lg">
              COMPLETE TASK
            </button>
          </section>

        </div>
      </div>
    </main>
  );
}
