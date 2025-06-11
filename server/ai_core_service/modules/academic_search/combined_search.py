# modules/academic_search/combined_search.py
import pandas as pd
import os
import re # For extracting year from title
import logging # Ensure logging is imported
logger = logging.getLogger(__name__) # Get a logger for this module

# Import from sibling modules
from .openalex_api import search_openalex
from .scholar_api import search_google_scholar

def run_combined_search(query, output_dir,
                        fetch_openalex=True, openalex_max_records=200,
                        fetch_scholar=True, scholar_max_results=50,
                        filter_min_year=None,
                        openalex_all_types=True, openalex_journals=False,
                        openalex_conference=False, openalex_book_chapter=False,
                        scholar_all_types=True, scholar_journals=False,
                        scholar_conference=False, scholar_book_chapter=False):
    """
    Runs searches on OpenAlex and Google Scholar, combines, filters, and saves results.
    """
    os.makedirs(output_dir, exist_ok=True)
    all_dfs = []

    if fetch_openalex:
        logger.info(f"--- Starting OpenAlex Search for query: '{query}' ---")
        df_openalex = search_openalex(
            query,
            max_records=openalex_max_records,
            all_types=openalex_all_types,
            journals=openalex_journals,
            conference=openalex_conference,
            book_chapter=openalex_book_chapter
        )
        if not df_openalex.empty:
            all_dfs.append(df_openalex)
        logger.info(f"OpenAlex search complete. Found {len(df_openalex)} records.")
    else:
        logger.info("Skipping OpenAlex search.")


    if fetch_scholar:
        logger.info(f"--- Starting Google Scholar Search for query: '{query}' ---")
        df_scholar = search_google_scholar(
            query,
            max_results=scholar_max_results,
            all_types=scholar_all_types,
            journals=scholar_journals,
            conference=scholar_conference,
            book_chapter=scholar_book_chapter
        )
        if not df_scholar.empty:
            all_dfs.append(df_scholar)
        logger.info(f"Google Scholar search complete. Found {len(df_scholar)} records.")
    else:
        logger.info("Skipping Google Scholar search.")


    if not all_dfs:
        logger.warning("No results fetched from any source. Returning empty DataFrame.")
        return pd.DataFrame()

    df_combined = pd.concat(all_dfs, ignore_index=True)
    logger.info(f"Total records before deduplication: {len(df_combined)}")

    if df_combined.empty:
        logger.warning("Combined DataFrame is empty before deduplication. Returning empty DataFrame.")
        return pd.DataFrame()

    # Deduplication based on title (case-insensitive, whitespace-stripped)
    if 'title' not in df_combined.columns:
        logger.error("'title' column missing from combined DataFrame. Cannot perform deduplication by title. Returning combined data.")
        # Decide behavior: return df_combined, or empty, or raise error
        return df_combined # Or pd.DataFrame() if critical

    df_combined['title_lower_stripped'] = df_combined['title'].fillna('').astype(str).str.lower().str.strip()
    # Using .copy() after drop_duplicates to ensure df_unique is a new DataFrame
    df_unique = df_combined.drop_duplicates(subset=['title_lower_stripped'], keep='first').copy()
    df_unique.drop(columns=['title_lower_stripped'], inplace=True) # inplace=True modifies df_unique directly
    logger.info(f"Total records after deduplication: {len(df_unique)}")

    if df_unique.empty:
        logger.warning("DataFrame is empty after deduplication. Returning empty DataFrame.")
        return pd.DataFrame()

    # Ensure 'year' column consistency and attempt to extract if missing
    if 'year' not in df_unique.columns:
        df_unique.loc[:, 'year'] = pd.NA # Use .loc for assignment to avoid SettingWithCopyWarning

    # Convert to string, replacing various forms of missing/empty with pd.NA before .astype(str)
    df_unique.loc[:, 'year'] = df_unique['year'].fillna(pd.NA).replace('', pd.NA).astype(str)

    # Identify rows where 'year' is effectively missing
    missing_years_mask = df_unique['year'].isna() | \
                         (df_unique['year'].str.lower() == 'nan') | \
                         (df_unique['year'].str.lower() == 'none') | \
                         (df_unique['year'] == '') | \
                         (df_unique['year'] == '<NA>') # Pandas new NA marker when converted to string

    num_missing_before = missing_years_mask.sum()
    logger.info(f"Number of records with missing years (before title extraction): {num_missing_before}")

    # Corrected Year Extraction Block:
    if num_missing_before > 0:
        if 'title' in df_unique.columns:
            logger.info("Attempting to extract missing years from titles...")
            # Process titles for extraction, ensuring they are strings and handling NaNs
            titles_for_extraction = df_unique.loc[missing_years_mask, 'title'].fillna('').astype(str)
            logger.debug(f"Titles for year extraction (first 5 of those missing):\n{titles_for_extraction.head().to_string()}")

            # str.extract with expand=False and one capture group returns a Pandas Series.
            extracted_years_series = titles_for_extraction.str.extract(r'((?:19|20)\d{2})', expand=False)
            # extracted_years_series will be a Series with the same index as titles_for_extraction.
            # Values will be the extracted year string or NaN if no match.
            logger.debug(f"Extracted years series (first 5 of those attempted, type: {type(extracted_years_series)}):\n{extracted_years_series.head().to_string()}")


            # Assign this Series directly to the 'year' column for the masked rows.
            # Pandas will align based on the index.
            # Ensure to only assign where extracted_years_series is not NaN to avoid overwriting valid but non-numeric years with NaN
            valid_extracted_mask = extracted_years_series.notna()
            df_unique.loc[missing_years_mask & valid_extracted_mask, 'year'] = extracted_years_series[valid_extracted_mask]
            
            # Re-calculate missing years after attempt
            current_missing_mask = df_unique['year'].isna() | \
                                   (df_unique['year'].str.lower() == 'nan') | \
                                   (df_unique['year'].str.lower() == 'none') | \
                                   (df_unique['year'] == '') | \
                                   (df_unique['year'] == '<NA>')
            num_still_missing = current_missing_mask.sum()
            logger.info(f"Number of records with missing years (after title extraction): {num_still_missing}")
        else:
            logger.warning("'title' column not found in df_unique, cannot extract missing years from titles.")
    # End of Corrected Year Extraction Block

    # Convert 'year' to numeric for comparison, coercing errors to NaT/NaN
    df_unique['year_numeric'] = pd.to_numeric(df_unique['year'], errors='coerce')
    logger.debug(f"DataFrame head after year processing and before filtering (first 3):\n{df_unique[['title', 'year', 'year_numeric']].head(3).to_string()}")


    # Filter by year if specified
    df_filtered = df_unique.copy() # Start with a copy to avoid modifying df_unique directly in this step
    if filter_min_year:
        try:
            min_year_numeric = int(filter_min_year)
            # Apply filter on the numeric year column. NaNs in year_numeric will result in False.
            valid_year_mask = df_filtered['year_numeric'] >= min_year_numeric
            df_filtered = df_filtered[valid_year_mask].copy() # Ensure it's a new DataFrame
            logger.info(f"Records after filtering for year >= {min_year_numeric}: {len(df_filtered)}")
        except ValueError:
            logger.warning(f"Invalid filter_min_year value '{filter_min_year}'. Year filtering skipped.")

    if df_filtered.empty:
        logger.warning("DataFrame is empty after year filtering. Returning empty DataFrame.")
        return pd.DataFrame()

    # Ensure 'citations' column exists, is numeric, and fill NaNs with 0
    if 'citations' not in df_filtered.columns:
        df_filtered.loc[:, 'citations'] = 0 # Use .loc for assignment
    df_filtered.loc[:, 'citations'] = pd.to_numeric(df_filtered['citations'], errors='coerce').fillna(0).astype(int)

    # Drop the temporary numeric year column before saving
    if 'year_numeric' in df_filtered.columns:
        df_filtered = df_filtered.drop(columns=['year_numeric'])

    # Reorder columns for better readability
    desired_columns = ['title', 'abstract', 'year', 'citations', 'source']
    # Get existing columns that are in desired_columns, in order
    final_columns = [col for col in desired_columns if col in df_filtered.columns]
    # Add any other columns that might exist but are not in desired_columns (to keep all data)
    final_columns += [col for col in df_filtered.columns if col not in final_columns] # Ensure no duplicates in final_columns list

    df_to_save = df_filtered[final_columns].copy() if not df_filtered.empty else pd.DataFrame(columns=final_columns)

    if not df_to_save.empty:
        csv_path = os.path.join(output_dir, "combined_academic_search_results.csv")
        df_to_save.to_csv(csv_path, index=False, encoding='utf-8') # Added encoding
        logger.info(f"Saved combined and filtered results to {csv_path}")
    else:
        logger.warning("No results to save after filtering (df_to_save is empty).")

    return df_to_save