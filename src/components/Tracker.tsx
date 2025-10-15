import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getFromDB, isCacheValid, setToDB } from '../db';
import type { Club, Match, PlayerUsageData, Team } from '../types';
import { apiFetch } from '../api';
import { years, seasonIdForYear, initialSeasonId } from '../utils';


interface TrackerProps {
    token: string;
    onLogout: () => void;
    onActivity: () => void;
}

function Tracker({ token, onLogout, onActivity }: TrackerProps) {
  // State
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const [error, setError] = useState<string | null>(null);

  // Club search
  const [clubQuery, setClubQuery] = useState('');
  const [seasonId, setSeasonId] = useState(initialSeasonId);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);

  // Team selection
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [genreFilter, setGenreFilter] = useState('');
  const [ageFilter, setAgeFilter] = useState('');
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<number>>(new Set());
  const [competitionId, setCompetitionId] = useState<number | null>(null);


  // Player Usage
  const [playerUsage, setPlayerUsage] = useState<PlayerUsageData | null>(null);

  // Handlers
  const searchForClubs = useCallback(async () => {
    if (!clubQuery) return;
    onActivity(); // Refresh session on activity
    setLoading(prev => ({ ...prev, clubs: true }));
    setError(null);
    try {
      const cacheKey = `${clubQuery}-${seasonId}`;
      const cached = await getFromDB<Club[]>(
        'club-search',
        cacheKey
      );
      if (isCacheValid(cached)) {
        setClubs(cached.data);
        return;
      }

      const body = new URLSearchParams();
      body.append('term', clubQuery);
      body.append('seasonId', seasonId);

      const response = await fetch(`/TournamentSearchPage/SearchClubs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body,
      });
      if (!response.ok)
        throw new Error(`Failed to fetch clubs. Status: ${response.status}`);
      
      type RawClubData = { value: number; label: string };
      const rawData: RawClubData[] = await response.json();

      // Filter out clubs without a name/id and ensure uniqueness by ID
      const uniqueClubs = new Map<number, RawClubData>();
      rawData.forEach(club => {
        if (club.value && club.label && club.label.trim() !== '') {
          uniqueClubs.set(club.value, club);
        }
      });
      
      const data: Club[] = Array.from(uniqueClubs.values()).map(club => ({
        id: club.value,
        name: club.label,
      }));


      setClubs(data);
      await setToDB('club-search', {
        key: cacheKey,
        data,
        timestamp: Date.now(),
      });
    } catch (err) {
      setError((err as Error).message);
      setClubs([]);
    } finally {
      setLoading(prev => ({ ...prev, clubs: false }));
    }
  }, [clubQuery, seasonId, onActivity]);

  const handleSearchClubs = (e: React.FormEvent) => {
    e.preventDefault();
    if (clubQuery) {
      searchForClubs();
    }
  };

  useEffect(() => {
    if (clubQuery.length < 3) {
      setClubs([]);
      return;
    }

    const debounceTimer = setTimeout(() => {
      searchForClubs();
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [clubQuery, searchForClubs]);

  const handleSelectClub = (club: Club) => {
    setSelectedClub(club);
    setClubs([]);
    setClubQuery('');
    setPlayerUsage(null);
    setSelectedTeamIds(new Set());
  };

  const handleFetchPlayerUsage = async () => {
    if (selectedTeamIds.size === 0 || !competitionId) {
        setError("Please select at least one team and a competition.");
        return;
    }
    onActivity(); // Refresh session on activity
    setLoading(prev => ({ ...prev, usage: true }));
    setError(null);
    setPlayerUsage(null);

    try {
        const teamIds = Array.from(selectedTeamIds);
        
        const matchListsPromises = teamIds.map(async (id) => {
            const cacheKey = `${id}-${competitionId}`;
            const cached = await getFromDB<{id: number}[]>('match-lists', cacheKey);
            if (isCacheValid(cached)) return cached.data;
            
            const res = await apiFetch(`/api/Matches?teamId=${id}&competitionId=${competitionId}`, token);
            if (!res.ok) throw new Error(`Failed fetching matches for team ${id}`);
            const data = await res.json();
            await setToDB('match-lists', { key: cacheKey, data, timestamp: Date.now() });
            return data;
        });

        const matchLists = await Promise.all(matchListsPromises);
        const allMatchIds = new Set(matchLists.flat().map(m => m.id));
        
        if (allMatchIds.size === 0) {
            setPlayerUsage({ players: {}, weeks: [], usage: {} });
            return;
        }

        const matchDetailsPromises = Array.from(allMatchIds).map(async (id) => {
            const cached = await getFromDB<Match>('match-details', id);
            if (isCacheValid(cached)) return cached.data;

            const res = await apiFetch(`/api/Matches/${id}`, token);
            if (!res.ok) throw new Error(`Failed fetching details for match ${id}`);
            const data = await res.json();
            await setToDB('match-details', { key: id, data, timestamp: Date.now() });
            return data;
        });
        
        const allMatchDetails: Match[] = await Promise.all(matchDetailsPromises);
        
        const players: { [key: string]: string } = {};
        const usage: { [key: string]: { [key: string]: string } } = {};
        const weekSet = new Set<number>();

        allMatchDetails.forEach(match => {
            const team = selectedTeamIds.has(match.homeTeam.id) ? match.homeTeam : match.awayTeam;
            if (!selectedTeamIds.has(team.id)) return;

            weekSet.add(match.week);

            team.players.forEach(player => {
                const playerId = player.personId.toString();
                if (!players[playerId]) {
                    players[playerId] = `${player.firstName} ${player.lastName}`;
                    usage[playerId] = {};
                }
                usage[playerId][`Uke ${match.week}`] = team.name;
            });
        });

        const weeks = Array.from(weekSet).sort((a, b) => a - b).map(w => `Uke ${w}`);
        setPlayerUsage({ players, weeks, usage });

    } catch (err) {
        setError((err as Error).message);
    } finally {
        setLoading(prev => ({ ...prev, usage: false }));
    }
  };

  const handleTeamSelection = (teamId: number) => {
    setSelectedTeamIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(teamId)) {
        newSet.delete(teamId);
      } else {
        newSet.add(teamId);
      }
      return newSet;
    });
  };

  useEffect(() => {
    if (!selectedClub) return;

    const fetchTeams = async () => {
        onActivity(); // Refresh session on activity
        setLoading(prev => ({ ...prev, teams: true }));
        setError(null);
        try {
            const cached = await getFromDB<Team[]>('teams', selectedClub.id);
            if (isCacheValid(cached)) {
                setAllTeams(cached.data);
                return;
            }

            const response = await apiFetch(`/api/Teams?clubId=${selectedClub.id}`, token);
            if (!response.ok) throw new Error('Failed to fetch teams.');
            const data = await response.json();
            setAllTeams(data);
            await setToDB('teams', { key: selectedClub.id, data, timestamp: Date.now() });
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(prev => ({ ...prev, teams: false }));
        }
    };
    fetchTeams();
  }, [selectedClub, token, onActivity]);
  
  const { filteredTeams, genreOptions, ageOptions, competitionOptions } = useMemo(() => {
    const genreSet = new Set<string>();
    const ageSet = new Set<string>();
    const compMap = new Map<number, string>();
    
    allTeams.forEach(team => {
      genreSet.add(team.genre.name);
      ageSet.add(team.ageCategory.name);
      team.competitions.forEach(c => {
          if (!compMap.has(c.id)) compMap.set(c.id, c.name);
      });
    });

    const teams = allTeams.filter(team => 
      (!genreFilter || team.genre.name === genreFilter) &&
      (!ageFilter || team.ageCategory.name === ageFilter)
    );
    
    return {
      filteredTeams: teams,
      genreOptions: Array.from(genreSet).sort(),
      ageOptions: Array.from(ageSet).sort(),
      competitionOptions: Array.from(compMap.entries()).map(([id, name]) => ({id, name})).sort((a, b) => a.name.localeCompare(b.name)),
    };
  }, [allTeams, genreFilter, ageFilter]);
  
  useEffect(() => {
    setCompetitionId(null);
  }, [selectedClub]);

  const selectedTeamsCompetitions = useMemo(() => {
    if (selectedTeamIds.size === 0) return competitionOptions;
    
    const teamCompetitions = allTeams
      .filter(t => selectedTeamIds.has(t.id))
      .flatMap(t => t.competitions);
    
    const commonCompetitions = new Map<number, string>();
    teamCompetitions.forEach(c => commonCompetitions.set(c.id, c.name));
    
    return Array.from(commonCompetitions.entries()).map(([id, name]) => ({ id, name })).sort((a,b) => a.name.localeCompare(b.name));
  }, [selectedTeamIds, allTeams, competitionOptions]);

  return (
    <>
      <header>
        <h1>Football Player Tracker</h1>
        <button onClick={onLogout}>Logout</button>
      </header>
      <main>
        {error && <p className="error-message" role="alert">{error}</p>}

        <div className="tracker-section">
          <h2>1. Find a Club</h2>
          <form onSubmit={handleSearchClubs} className="search-form">
            <div className="form-group" style={{ flexGrow: 2 }}>
              <label htmlFor="club-search-input">Club Name</label>
              <input
                id="club-search-input"
                type="text"
                value={clubQuery}
                onChange={e => setClubQuery(e.target.value)}
                placeholder="e.g., Nesodden IF (start typing...)"
              />
            </div>
            <div className="form-group" style={{ flexGrow: 1 }}>
              <label htmlFor="season-select">Season</label>
              <select
                id="season-select"
                value={seasonId}
                onChange={e => setSeasonId(e.target.value)}
              >
                {years.map(year => (
                  <option key={year} value={seasonIdForYear(year)}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" disabled={!clubQuery || loading.clubs}>
              {loading.clubs ? 'Searching...' : 'Search'}
            </button>
          </form>
          {clubs.length > 0 && (
            <ul className="results-list" role="listbox">
              {clubs.map(club => (
                <li
                  key={club.id}
                  onClick={() => handleSelectClub(club)}
                  role="option"
                  aria-selected="false"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleSelectClub(club)}
                >
                  {club.name}
                </li>
              ))}
            </ul>
          )}
        </div>
        
        {selectedClub && (
          <div className="tracker-section">
            <h2>2. Select Teams for {selectedClub.name}</h2>
            {loading.teams ? <div className="loading-spinner" aria-label="Loading teams"></div> : (
                <>
                <div className="filters">
                    <div className="form-group">
                        <label htmlFor="genre-filter">Filter by Genre</label>
                        <select id="genre-filter" value={genreFilter} onChange={e => setGenreFilter(e.target.value)}>
                            <option value="">All Genres</option>
                            {genreOptions.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="age-filter">Filter by Age Class</label>
                        <select id="age-filter" value={ageFilter} onChange={e => setAgeFilter(e.target.value)}>
                            <option value="">All Ages</option>
                            {ageOptions.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                    </div>
                </div>
                <div className="team-list" role="group" aria-labelledby="team-list-heading">
                    {filteredTeams.map(team => (
                        <div key={team.id} className="team-item">
                            <input
                                type="checkbox"
                                id={`team-${team.id}`}
                                checked={selectedTeamIds.has(team.id)}
                                onChange={() => handleTeamSelection(team.id)}
                            />
                            <label htmlFor={`team-${team.id}`}>{team.name}</label>
                        </div>
                    ))}
                </div>
              </>
            )}
          </div>
        )}

        {selectedTeamIds.size > 0 && (
            <div className="tracker-section">
                <h2>3. Analyze Player Usage</h2>
                <div className="form-group">
                    <label htmlFor="competition-select">Select Competition</label>
                    <select 
                      id="competition-select"
                      value={competitionId || ''} 
                      onChange={e => setCompetitionId(Number(e.target.value))}
                      disabled={selectedTeamsCompetitions.length === 0}
                      aria-required="true"
                    >
                        <option value="">-- Select a competition --</option>
                        {selectedTeamsCompetitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <button onClick={handleFetchPlayerUsage} disabled={loading.usage || !competitionId}>
                    {loading.usage ? 'Analyzing...' : 'Analyze Player Usage'}
                </button>
            </div>
        )}

        {loading.usage && <div className="loading-spinner" aria-label="Analyzing player usage"></div>}
        
        {playerUsage && (
          <div className="tracker-section">
            <h2>Player Usage Results</h2>
            {playerUsage.weeks.length > 0 ? (
                <div className="usage-table-container">
                    <table className="usage-table">
                        <thead>
                            <tr>
                                <th scope="col">Player Name</th>
                                {playerUsage.weeks.map(week => <th scope="col" key={week}>{week}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(playerUsage.players)
                                .sort(([, nameA]: [string, string], [, nameB]: [string, string]) => nameA.localeCompare(nameB))
                                .map(([playerId, playerName]) => (
                                <tr key={playerId}>
                                    <th scope="row">{playerName}</th>
                                    {playerUsage.weeks.map(week => (
                                        <td key={week}>
                                            {playerUsage.usage[playerId]?.[week] || '—'}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : <p>No match data found for the selected teams in this competition.</p>}
          </div>
        )}
      </main>
    </>
  );
}

export default Tracker;