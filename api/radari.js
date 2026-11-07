export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');

  try {
    const pageRes = await fetch('https://bihamk.ba/spi/radari?radar=non-stationary', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const html = await pageRes.text();
    const cookie = pageRes.headers.get('set-cookie') || '';

    const tokenMatch = html.match(/_token["\']?\s*:\s*["\']([^"\']+)["\']/i) || html.match(/name="csrf-token"\s+content="([^"]+)"/i);
    const token = tokenMatch ? tokenMatch[1] : '';

    const snapshotMatch = html.match(/wire:snapshot="([^"]+)"/i);
    const snapshot = snapshotMatch ? snapshotMatch[1].replace(/&quot;/g, '"') : '';

    const stations = [
      { id: 360, canton: 'SBK', station: 'PS Fojnica', town: 'Fojnica', road: 'Lokalni' },
      { id: 361, canton: 'SBK', station: 'PS Kiseljak', town: 'Kiseljak', road: 'M-5' },
      { id: 362, canton: 'SBK', station: 'PS Travnik', town: 'Travnik', road: 'M-5' },
      { id: 363, canton: 'SBK', station: 'PS Vitez', town: 'Vitez', road: 'M-5' },
      { id: 364, canton: 'SBK', station: 'PS Busovača', town: 'Busovača', road: 'M-5' },
      { id: 365, canton: 'SBK', station: 'PS Kreševo', town: 'Kreševo', road: 'R-443' },
      { id: 366, canton: 'SBK', station: 'PS Bugojno', town: 'Bugojno', road: 'M-16' },
      { id: 367, canton: 'SBK', station: 'PS Novi Travnik', town: 'Novi Travnik', road: 'M-16.4' },
      { id: 393, canton: 'KS', station: 'PS Centar', town: 'Sarajevo', road: 'Gradska' },
      { id: 394, canton: 'KS', station: 'MUP Kantona Sarajevo', town: 'Ilidža', road: 'M-17' },
      { id: 326, canton: 'ZDK', station: 'PS Tešanj', town: 'Tešanj', road: 'M-4' },
      { id: 327, canton: 'ZDK', station: 'PS Maglaj', town: 'Maglaj', road: 'M-17' },
      { id: 325, canton: 'ZDK', station: 'PS Olovo M-18', town: 'Olovo', road: 'M-18' },
      { id: 350, canton: 'TK', station: 'PS Gradačac', town: 'Gradačac', road: 'M-1.9' },
      { id: 351, canton: 'TK', station: 'PS Srebrenik', town: 'Srebrenik', road: 'M-1.8' },
      { id: 370, canton: 'POSAVINA', station: 'MUP Posavski', town: 'Orašje', road: 'M-1.8' }
    ];

    const results = [];

    for (const st of stations) {
      try {
        const lwRes = await fetch('https://bihamk.ba/livewire/update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': token,
            'Cookie': cookie,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          body: JSON.stringify({
            _token: token,
            components: [{
              snapshot: snapshot,
              updates: {},
              calls: [{ path: '', method: 'loadModal', params: [st.id] }]
            }]
          })
        });

        const lwData = await lwRes.json();
        const modalHtml = lwData?.components?.[0]?.effects?.html || '';

        const lineMatches = modalHtml.match(/[0-2]?\d:[0-5]\d\s*(?:do|-)\s*[0-2]?\d:[0-5]\d\s*(?:sati)?[^<]+/gi) || [];
        const announcements = lineMatches.map(l => l.replace(/&nbsp;/g, ' ').trim());

        if (announcements.length > 0) {
          results.push({ ...st, announcements });
        }
      } catch (err) {}
    }

    return res.status(200).json(results);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch BIHAMK: ' + error.message });
  }
}
