export default async function handler(req, res) {
  // Cache response on Vercel Edge for 10 minutes
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');

  try {
    // 1. Fetch initial BIHAMK page
    const pageRes = await fetch('https://bihamk.ba/spi/radari?radar=non-stationary', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const html = await pageRes.text();
    const cookie = pageRes.headers.get('set-cookie') || '';

    // Extract CSRF token and Livewire component snapshot
    const tokenMatch = html.match(/_token["\']?\s*:\s*["\']([^"\']+)["\']/i) || html.match(/name="csrf-token"\s+content="([^"]+)"/i);
    const token = tokenMatch ? tokenMatch[1] : '';

    const snapshotMatch = html.match(/wire:snapshot="([^"]+)"/i);
    const snapshot = snapshotMatch ? snapshotMatch[1].replace(/&quot;/g, '"') : '';

    // 2. Dynamically extract station cards and daily loadModal(ID) from HTML
    const cardRegex = /<article[^>]*wire:click="loadModal\((\d+)\)"[\s\S]*?<span[^>]*class="[^"]*font-medium[^"]*"[^>]*>\s*([^<]+?)\s*<\/span>/gi;
    
    const detectedStations = [];
    let match;
    while ((match = cardRegex.exec(html)) !== null) {
      const id = parseInt(match[1], 10);
      const station = match[2].trim();
      
      let town = station.replace(/^(PS|MUP)\s+/i, '').replace(/\s+M-\d+/i, '').trim();
      let canton = 'BIH';
      let road = 'Lokalni';

      if (/Fojnica/i.test(station)) { town = 'Fojnica'; canton = 'SBK'; }
      else if (/Kiseljak/i.test(station)) { town = 'Kiseljak'; canton = 'SBK'; road = 'M-5'; }
      else if (/Travnik/i.test(station) && !/Novi/i.test(station)) { town = 'Travnik'; canton = 'SBK'; road = 'M-5'; }
      else if (/Vitez/i.test(station)) { town = 'Vitez'; canton = 'SBK'; road = 'M-5'; }
      else if (/Busovača/i.test(station)) { town = 'Busovača'; canton = 'SBK'; road = 'M-5'; }
      else if (/Kreševo/i.test(station)) { town = 'Kreševo'; canton = 'SBK'; road = 'R-443'; }
      else if (/Bugojno/i.test(station)) { town = 'Bugojno'; canton = 'SBK'; road = 'M-16'; }
      else if (/Novi Travnik/i.test(station)) { town = 'Novi Travnik'; canton = 'SBK'; road = 'M-16.4'; }
      else if (/Centar|Sarajevo/i.test(station)) { town = 'Sarajevo'; canton = 'KS'; road = 'Gradska'; }
      else if (/Ilidža|Vogošća/i.test(station)) { town = 'Ilidža'; canton = 'KS'; road = 'M-17'; }
      else if (/Tešanj/i.test(station)) { town = 'Tešanj'; canton = 'ZDK'; road = 'M-4'; }
      else if (/Maglaj/i.test(station)) { town = 'Maglaj'; canton = 'ZDK'; road = 'M-17'; }
      else if (/Olovo/i.test(station)) { town = 'Olovo'; canton = 'ZDK'; road = 'M-18'; }
      else if (/Gradačac/i.test(station)) { town = 'Gradačac'; canton = 'TK'; road = 'M-1.9'; }
      else if (/Srebrenik/i.test(station)) { town = 'Srebrenik'; canton = 'TK'; road = 'M-1.8'; }
      else if (/Orašje|Posav/i.test(station)) { town = 'Orašje'; canton = 'POSAVINA'; road = 'M-1.8'; }

      detectedStations.push({ id, station, town, canton, road });
    }

    const results = [];

    // 3. Query Livewire for each detected station
    for (const st of detectedStations) {
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
        const announcements = lineMatches.map(l => l.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim());

        if (announcements.length > 0) {
          results.push({ ...st, announcements });
        }
      } catch (err) {}
    }

    if (results.length > 0) {
      return res.status(200).json(results);
    } else {
      throw new Error('No radar items parsed from Livewire');
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
